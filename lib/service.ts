import { database } from './storage';
import { decrypt, encrypt } from './crypto';
import { Balance, binanceBalances, ethereumBalances, ProviderError, upbitBalances } from './exchanges';
import { pricesFor } from './prices';
import { PublicError } from './errors';
import { publicConnection, redactAddresses } from './privacy';
import { Asset, classify, coinNames, Connection, koreaDay, nextIndex, Portfolio, profiles, Snapshot, totalValue } from './portfolio';
type ConnectionRow={id:string;user_id:string;type:Connection['type'];label:string;address:string|null;credentials:string|null;balances:string;status:string;error:string|null;last_sync:string|null};
type SnapshotRow={day:string;value:number;return_index:number;flow:number;recorded_at:string};
// Upgrade legacy plaintext wallets in place. Existing snapshots and IDs are preserved.
async function protectWallet(row:ConnectionRow,userId:string){
 if(row.type!=='ethereum'||!row.address)return;
 const credentials=await encrypt({address:row.address},userId);
 await database().prepare('UPDATE connections SET credentials = ?, address = NULL WHERE id = ? AND user_id = ? AND address = ?').bind(credentials,row.id,userId,row.address).run();
 row.credentials=credentials;row.address=null;
}
async function walletAddress(row:{address:string|null;credentials:string|null},userId:string){
 if(row.address)return row.address;
 if(!row.credentials)throw new PublicError('지갑 연결을 다시 설정하세요.');
 return (await decrypt<{address:string}>(row.credentials,userId)).address;
}
const history=(rows:SnapshotRow[]):Snapshot[]=>rows.map(r=>({day:r.day,value:r.value,index:r.return_index,flow:r.flow,recordedAt:r.recorded_at}));
export async function getPortfolio(userId:string):Promise<Portfolio>{
 const db=database();
 const [conns,snaps,portfolio,settings,job]=await Promise.all([
  db.prepare('SELECT * FROM connections WHERE user_id = ? ORDER BY created_at').bind(userId).all<ConnectionRow>(),
  db.prepare('SELECT day, value, return_index, flow, recorded_at FROM snapshots WHERE user_id = ? ORDER BY day').bind(userId).all<SnapshotRow>(),
  db.prepare('SELECT payload, updated_at FROM portfolios WHERE user_id = ?').bind(userId).first<{payload:string;updated_at:string|null}>(),
  db.prepare('SELECT profile FROM settings WHERE user_id = ?').bind(userId).first<{profile:string}>(),
  db.prepare('SELECT status, finished_at FROM jobs WHERE id = ?').bind('daily').first<{status:string;finished_at:string}>(),
 ]);
 const cached=portfolio?JSON.parse(portfolio.payload) as {assets:Asset[];warnings:string[]}:null;
 await Promise.all(conns.results.map(row=>protectWallet(row,userId)));
 return {mode:'live',assets:(cached?.assets??[]).map(a=>({...a,sources:a.sources.map(redactAddresses)})),warnings:(cached?.warnings??[]).map(redactAddresses),updatedAt:portfolio?.updated_at??null,connections:conns.results.map(publicConnection),history:history(snaps.results),profile:settings?.profile??'balanced',job:job?{status:job.status,finishedAt:job.finished_at}:null};
}
export async function addConnection(userId:string,input:{type:string;label:string;apiKey?:string;secret?:string;address?:string}){
 if(!['binance','upbit','ethereum'].includes(input.type))throw new PublicError('지원하지 않는 연결 종류입니다.');
 const label=(input.label??'').trim();if(!label||label.length>40)throw new PublicError('연결 이름을 1~40자로 입력하세요.');
 const db=database(),count=await db.prepare('SELECT count(*) AS n FROM connections WHERE user_id = ?').bind(userId).first<{n:number}>();if((count?.n??0)>=6)throw new PublicError('거래소와 지갑은 최대 6개까지 연결할 수 있습니다.');
 let credentials:string|null=null;const address=null;
 if(input.type==='ethereum'){
  const rawAddress=input.address?.trim()??'';
  if(!/^0x[a-fA-F0-9]{40}$/.test(rawAddress))throw new PublicError('올바른 이더리움 주소를 입력하세요.');
  const existing=await db.prepare('SELECT address, credentials FROM connections WHERE user_id = ? AND type = ?').bind(userId,'ethereum').all<{address:string|null;credentials:string|null}>();
  for(const row of existing.results)if((await walletAddress(row,userId)).toLowerCase()===rawAddress.toLowerCase())throw new PublicError('이미 연결된 지갑입니다.');
  credentials=await encrypt({address:rawAddress},userId);
 }
 else {const apiKey=input.apiKey?.trim(),secret=input.secret?.trim();if(!apiKey||!secret||apiKey.length>512||secret.length>1024)throw new PublicError('올바른 API 키와 Secret Key를 입력하세요.');const existing=await db.prepare('SELECT credentials FROM connections WHERE user_id = ? AND type = ?').bind(userId,input.type).all<{credentials:string}>();for(const row of existing.results){const keys=await decrypt<{apiKey:string}>(row.credentials,userId);if(keys.apiKey===apiKey)throw new PublicError('이미 등록한 API 키입니다. 같은 계정은 한 번만 연결하세요.');}if(label.includes(apiKey)||label.includes(secret))throw new PublicError('연결 이름에 API 키를 포함하지 마세요.');credentials=await encrypt({apiKey,secret},userId);}
 const id=crypto.randomUUID();await db.batch([
  db.prepare('INSERT INTO connections (id,user_id,type,label,address,credentials,created_at) VALUES (?,?,?,?,?,?,?)').bind(id,userId,input.type,label,address,credentials,new Date().toISOString()),
  db.prepare('INSERT INTO settings (user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING').bind(userId),
 ]);return {id};
}
export async function removeConnection(userId:string,id:string){const db=database();await db.prepare('DELETE FROM connections WHERE id = ? AND user_id = ?').bind(id,userId).run();await db.prepare('DELETE FROM portfolios WHERE user_id = ?').bind(userId).run();}
export async function setProfile(userId:string,profile:string){if(!profiles[profile])throw new PublicError('올바른 비중 모델을 선택하세요.');await database().prepare('INSERT INTO settings (user_id,profile) VALUES (?,?) ON CONFLICT (user_id) DO UPDATE SET profile = excluded.profile').bind(userId,profile).run();}
export async function recomputeReturns(userId:string){const db=database();const [snaps,flows]=await Promise.all([db.prepare('SELECT day,value,return_index,flow,recorded_at FROM snapshots WHERE user_id = ? ORDER BY day').bind(userId).all<SnapshotRow>(),db.prepare('SELECT day,amount FROM flows WHERE user_id = ? ORDER BY day').bind(userId).all<{day:string;amount:number}>()]);let previous:Snapshot|undefined;const statements:D1PreparedStatement[]=[];for(const s of history(snaps.results)){const flow=previous?flows.results.filter(f=>f.day>previous!.day&&f.day<=s.day).reduce((n,f)=>n+f.amount,0):0;if(previous&&s.value-flow<0)throw new PublicError('입출금액이 평가액보다 큽니다. 해당 날짜의 순입출금액을 확인하세요.');const index=nextIndex(previous,s.value,flow);statements.push(db.prepare('UPDATE snapshots SET return_index = ?, flow = ? WHERE user_id = ? AND day = ?').bind(index,flow,userId,s.day));previous={...s,index,flow};}if(statements.length)await db.batch(statements);}
export async function setFlow(userId:string,day:string,amount:number){if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(amount)||Math.abs(amount)>1e12)throw new PublicError('올바른 날짜와 금액을 입력하세요.');const db=database(),first=await db.prepare('SELECT day FROM snapshots WHERE user_id = ? ORDER BY day LIMIT 1').bind(userId).first<{day:string}>();if(!first||day<=first.day||day>koreaDay())throw new PublicError('첫 기준일 다음 날부터 오늘까지의 입출금을 기록할 수 있습니다.');const old=await db.prepare('SELECT amount FROM flows WHERE user_id = ? AND day = ?').bind(userId,day).first<{amount:number}>();await db.prepare('INSERT INTO flows (user_id,day,amount) VALUES (?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET amount = excluded.amount').bind(userId,day,amount).run();try{await recomputeReturns(userId);}catch(e){if(old)await db.prepare('UPDATE flows SET amount = ? WHERE user_id = ? AND day = ?').bind(old.amount,userId,day).run();else await db.prepare('DELETE FROM flows WHERE user_id = ? AND day = ?').bind(userId,day).run();throw e;}}
export async function syncPortfolio(userId:string,recordDaily=false):Promise<Portfolio>{
 const db=database(),now=Date.now(),lease=crypto.randomUUID();
 await db.prepare('INSERT INTO settings (user_id) VALUES (?) ON CONFLICT(user_id) DO NOTHING').bind(userId).run();
 const lock=await db.prepare('UPDATE settings SET sync_lock = ?, lock_until = ? WHERE user_id = ? AND lock_until < ? RETURNING user_id').bind(lease,now+120000,userId,now).first();if(!lock)throw new PublicError('동기화가 이미 진행 중입니다. 잠시 후 다시 확인하세요.');
 try{
  const rows=(await db.prepare('SELECT * FROM connections WHERE user_id = ? ORDER BY created_at').bind(userId).all<ConnectionRow>()).results;
  if(!rows.length)return await getPortfolio(userId);
  const result=await Promise.allSettled(rows.map(async row=>{
   let balances:Balance[];
   if(row.type==='ethereum'){await protectWallet(row,userId);balances=await ethereumBalances(await walletAddress(row,userId));}
   else {const keys=await decrypt<{apiKey:string;secret:string}>(row.credentials!,userId);balances=await (row.type==='binance'?binanceBalances:upbitBalances)(keys.apiKey,keys.secret);}
   const seen=new Set<string>();for(const b of balances){if(!Number.isFinite(b.amount)||b.amount<0||!b.symbol||seen.has(b.symbol))throw new ProviderError('잔고 응답이 올바르지 않습니다.');seen.add(b.symbol);}
   return balances;
  }));
  const warnings:string[]=[],combined=new Map<string,{amount:number;sources:Set<string>}>();
  const writes:D1PreparedStatement[]=[],time=new Date().toISOString();
  result.forEach((r,i)=>{const row=rows[i];let balances:Balance[];if(r.status==='fulfilled'){balances=r.value;writes.push(db.prepare('UPDATE connections SET balances = ?, status = ?, error = NULL, last_sync = ? WHERE id = ? AND user_id = ?').bind(JSON.stringify(balances),'ok',time,row.id,userId));}else{const message=r.reason instanceof ProviderError?r.reason.message:'잔고 조회에 실패했습니다. 연결 설정과 서버 설정을 확인하세요.';warnings.push(`${row.label}: ${message} ${row.last_sync?'이전 잔고를 유지했습니다.':'첫 잔고를 가져오지 못했습니다.'}`);balances=JSON.parse(row.balances) as Balance[];writes.push(db.prepare('UPDATE connections SET status = ?, error = ? WHERE id = ? AND user_id = ?').bind('error',message,row.id,userId));}for(const b of balances){const existing=combined.get(b.symbol)||{amount:0,sources:new Set<string>()};existing.amount+=b.amount;existing.sources.add(row.label);combined.set(b.symbol,existing);}});
  if(writes.length)await db.batch(writes);
  const prices=await pricesFor([...combined.keys()]);
  const assets:Asset[]=[...combined].map(([symbol,b])=>({symbol,name:coinNames[symbol]??symbol,amount:b.amount,price:prices[symbol]?.price??null,value:prices[symbol]?b.amount*prices[symbol].price:null,change24h:prices[symbol]?.change??null,category:classify(symbol),sources:[...b.sources]})).sort((a,b)=>(b.value??0)-(a.value??0));
  const complete=!warnings.length&&assets.every(a=>a.price!==null);
  if(!complete)warnings.push('일부 잔고 또는 시세가 빠져 오늘의 스냅샷은 저장하지 않았습니다.');
  const prev=await db.prepare('SELECT updated_at FROM portfolios WHERE user_id = ?').bind(userId).first<{updated_at:string|null}>();
  await db.prepare('INSERT INTO portfolios (user_id,payload,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at').bind(userId,JSON.stringify({assets,warnings}),complete?time:prev?.updated_at??null).run();
  const first=await db.prepare('SELECT day FROM snapshots WHERE user_id = ? LIMIT 1').bind(userId).first();
  if(complete&&totalValue(assets)>0&&(recordDaily||!first)){
   const day=koreaDay();await db.prepare('INSERT INTO snapshots (user_id,day,value,return_index,flow,recorded_at) VALUES (?,?,?,100,0,?) ON CONFLICT(user_id,day) DO UPDATE SET value = excluded.value, recorded_at = excluded.recorded_at').bind(userId,day,totalValue(assets),time).run();await recomputeReturns(userId);
  }
  return await getPortfolio(userId);
 }finally{await db.prepare('UPDATE settings SET sync_lock = NULL, lock_until = 0 WHERE user_id = ? AND sync_lock = ?').bind(userId,lease).run();}
}
export async function runDaily(){
 const db=database(),owners=(await db.prepare('SELECT DISTINCT user_id FROM connections').all<{user_id:string}>()).results;let updated=0,failed=0;
 for(const owner of owners){try{const p=await syncPortfolio(owner.user_id,true);if(p.warnings.length)failed++;else updated++;}catch{failed++;}}
 const status=owners.length===0?'waiting-for-connection':failed?'partial-failure':'succeeded',finishedAt=new Date().toISOString();
 await db.prepare('INSERT INTO jobs (id,status,finished_at,updated,failed) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, finished_at = excluded.finished_at, updated = excluded.updated, failed = excluded.failed').bind('daily',status,finishedAt,updated,failed).run();return {status,finishedAt,updated,failed};
}
export async function dailyStatus(){return await database().prepare('SELECT status, finished_at AS finishedAt, updated, failed FROM jobs WHERE id = ?').bind('daily').first();}
