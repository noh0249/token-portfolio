import { database } from './storage';
import { decrypt, encrypt, hex } from './crypto';
import { PublicError } from './errors';
import { Balance, ethereumBalances, tokenContracts } from './exchanges';
import { dexQuote, indexedNfts, indexedTokens, nftFloor, safeImageUrl, type DexPair, type IndexedNft, type IndexedToken } from './wallet-data';

const blockscout='https://eth.blockscout.com/api/v2',opensea='https://api.opensea.io/api/v2';
function retryDelay(response:Response){const header=response.headers.get('retry-after'),seconds=Number(header),date=Date.parse(header??''),reset=Number(response.headers.get('x-ratelimit-reset'))*1000;return Math.min(86400000,Math.max(60000,Number.isFinite(seconds)&&seconds>0?seconds*1000:Number.isFinite(date)&&date>Date.now()?date-Date.now():reset>Date.now()?reset-Date.now():600000));}
class RemoteError extends Error { constructor(readonly status:number,readonly delay=600000){super('Provider unavailable');} }
async function json<T>(url:string,headers?:Record<string,string>):Promise<T>{
 const r=await fetch(url,{headers:{Accept:'application/json',...headers},redirect:'manual',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new RemoteError(r.status,retryDelay(r));return await r.json() as T;
}
async function pages<T>(address:string,kind:'tokens'|'nft'):Promise<T[]> {
 const values:T[]=[],seen=new Set<string>();let cursor:Record<string,unknown>|null=null;
 for(let page=0;page<20;page++){
  const params=new URLSearchParams({type:kind==='tokens'?'ERC-20':'ERC-721,ERC-1155'});
  if(cursor)for(const [key,value] of Object.entries(cursor)){if(!['fiat_value','id','items_count','value','token_contract_address_hash','token_id','token_type'].includes(key)||!['string','number'].includes(typeof value)||String(value).length>160)throw Error('Invalid pagination');params.set(key,String(value));}
  const marker=params.toString();if(seen.has(marker))throw Error('Repeated pagination');seen.add(marker);
  const data=await json<{items:T[];next_page_params:Record<string,unknown>|null}>(`${blockscout}/addresses/${address}/${kind}?${params}`);
  if(!Array.isArray(data.items))throw Error('Invalid wallet response');values.push(...data.items);
  if(data.next_page_params===null)return values;
  if(!data.next_page_params||typeof data.next_page_params!=='object')throw Error('Incomplete wallet response');cursor=data.next_page_params;
 }
 throw Error('Wallet pagination limit');
}
export async function balanceId(balance:Balance):Promise<string>{return 'a_'+hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(balance.identity??balance.symbol)))).slice(0,32);}
type Preferences={brand_id:string|null;credentials:string|null;expires_at:number;retry_after:number};
async function keyFor(userId:string):Promise<string>{
 const db=database(),row=await db.prepare('SELECT credentials, expires_at, retry_after FROM nft_preferences WHERE user_id = ?').bind(userId).first<Preferences>(),now=Date.now();
 if((row?.retry_after??0)>now)throw Error('NFT key rate limited');
 if(row?.credentials&&(!row.expires_at||row.expires_at>now+60000))return (await decrypt<{apiKey:string}>(row.credentials,userId)).apiKey;
 // OpenSea documents account-free, expiring keys. Never rotate keys to evade quotas.
 const r=await fetch(`${opensea}/auth/keys`,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000)});
 if(!r.ok){await db.prepare('INSERT INTO nft_preferences (user_id,retry_after) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET retry_after = excluded.retry_after').bind(userId,now+retryDelay(r)).run();throw Error('NFT key unavailable');}
 const data=await r.json() as {api_key?:string;expires_at?:string};const expires=Date.parse(data.expires_at??'');
 if(!data.api_key||data.api_key.length>512||!Number.isFinite(expires)||expires<now+60000)throw Error('Invalid NFT key');
 await db.prepare('INSERT INTO nft_preferences (user_id,credentials,expires_at,retry_after) VALUES (?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET credentials = excluded.credentials, expires_at = excluded.expires_at, retry_after = 0').bind(userId,await encrypt({apiKey:data.api_key},userId),expires).run();return data.api_key;
}
export async function saveNftKey(userId:string,apiKey:string){
 if(typeof apiKey!=='string'||!apiKey.trim()||apiKey.length>512)throw new PublicError('올바른 OpenSea API 키를 입력하세요.');
 try{await json(`${opensea}/collections/boredapeyachtclub/stats`,{'X-API-KEY':apiKey.trim()});}catch{throw new PublicError('OpenSea API 키 또는 조회 한도를 확인하세요.');}
 await database().prepare('INSERT INTO nft_preferences (user_id,credentials,expires_at,retry_after) VALUES (?,?,0,0) ON CONFLICT(user_id) DO UPDATE SET credentials = excluded.credentials, expires_at = 0, retry_after = 0').bind(userId,await encrypt({apiKey:apiKey.trim()},userId)).run();
}
async function enrichNfts(userId:string,nfts:Balance[]):Promise<{balances:Balance[];available:boolean;failed:boolean}>{
 if(!nfts.length)return {balances:nfts,available:true,failed:false};
 let apiKey:string;try{apiKey=await keyFor(userId);}catch{return {balances:nfts,available:false,failed:false};}
 const contracts=[...new Set(nfts.map(n=>n.contract!))];let failed=false,halt=false;
 if(contracts.length>40)return {balances:nfts,available:false,failed:true};
 const quotes=new Map<string,{amount:number;currency:string}|null>(),images=new Map<string,string>();
 for(let start=0;start<contracts.length&&!halt;start+=3)await Promise.all(contracts.slice(start,start+3).map(async contract=>{
  const sample=nfts.find(n=>n.contract===contract)!;
  try{
   const meta=await json<{nft?:{collection?:string;display_image_url?:string;image_url?:string;is_disabled?:boolean;is_suspicious?:boolean}}>(`${opensea}/chain/ethereum/contract/${contract}/nfts/${sample.tokenId}`,{'X-API-KEY':apiKey});
   if(meta.nft?.is_disabled||meta.nft?.is_suspicious){quotes.set(contract,null);return;}
   const slug=meta.nft?.collection;if(!slug||!/^[-a-zA-Z0-9_]{1,200}$/.test(slug)){quotes.set(contract,null);return;}
   const image=safeImageUrl(meta.nft?.display_image_url??meta.nft?.image_url);if(image)images.set(sample.identity!,image);
   quotes.set(contract,nftFloor(await json(`${opensea}/collections/${slug}/stats`,{'X-API-KEY':apiKey})));
  }catch(error){failed=true;if(error instanceof RemoteError&&[401,403,429].includes(error.status)){halt=true;if(error.status===429)await database().prepare('UPDATE nft_preferences SET retry_after = ? WHERE user_id = ?').bind(Date.now()+error.delay,userId).run();}}
 }));
 return {balances:nfts.map(n=>{const floor=quotes.get(n.contract!);return {...n,imageUrl:images.get(n.identity!)??n.imageUrl,quoteAmount:floor?.amount,quoteCurrency:floor?.currency};}),available:!failed,failed};
}
export async function readWallet(userId:string,address:string,previous:Balance[]):Promise<{balances:Balance[];warnings:string[];notices:string[];nftPricing:boolean}>{
 const core=await ethereumBalances(address),warnings:string[]=[],notices:string[]=[];
 const [tokenResult,nftResult]=await Promise.allSettled([pages<IndexedToken>(address,'tokens').then(indexedTokens),pages<IndexedNft>(address,'nft').then(indexedNfts)]);
 let tokens:Balance[];
 if(tokenResult.status==='fulfilled')tokens=tokenResult.value;
 else{tokens=previous.filter(b=>b.kind==='token');warnings.push('지갑 토큰 자동 검색에 실패해 이전 조회 결과를 유지했습니다.');}
 const coreContracts=new Set(tokenContracts.map(t=>t.address.toLowerCase()));tokens=tokens.filter(t=>!coreContracts.has(t.contract??''));
 const unknown=tokens.filter(t=>!t.trusted&&t.contract);
 for(let offset=0;offset<unknown.length;offset+=30){
  const batch=unknown.slice(offset,offset+30);
  try{const pairs=await json<DexPair[]>(`https://api.dexscreener.com/tokens/v1/ethereum/${batch.map(t=>t.contract).join(',')}`);if(!Array.isArray(pairs))throw Error('Invalid DEX quotes');for(const token of batch){const quote=dexQuote(token.contract!,pairs);if(quote){token.quoteUsd=quote.usd;token.change=quote.change;token.market='DEX';token.imageUrl=quote.image??token.imageUrl;}}}catch{if(batch.some(t=>previous.some(p=>p.identity===t.identity&&p.market==='DEX')))warnings.push('일부 DEX 시세를 갱신하지 못했습니다.');}
 }
 let nfts:Balance[],nftPricing=false;
 if(nftResult.status==='fulfilled'){
  const enriched=await enrichNfts(userId,nftResult.value);nftPricing=enriched.available;
  nfts=enriched.balances.map(n=>{const old=previous.find(b=>b.identity===n.identity);return !n.quoteCurrency&&old?.quoteCurrency?{...n,quoteAmount:old.quoteAmount,quoteCurrency:old.quoteCurrency}:n;});
  if(!enriched.available&&nfts.length)notices.push('NFT 최저가 조회를 사용할 수 없습니다. 연결 설정에서 OpenSea API 키를 저장하면 평가액을 조회할 수 있습니다.');
  if(!enriched.available&&previous.some(b=>b.kind==='nft'&&b.quoteCurrency))warnings.push('NFT 평가액을 갱신하지 못해 이전 참고 가격을 유지했습니다.');
 }else{nfts=previous.filter(b=>b.kind==='nft');warnings.push('보유 NFT 검색에 실패해 이전 조회 결과를 유지했습니다.');}
 const balances=[...core,...tokens,...nfts];for(const balance of balances)if(balance.imageUrl?.toLowerCase().includes(address.toLowerCase()))balance.imageUrl=undefined;
 return {balances,warnings,notices,nftPricing};
}
export async function usdConversion():Promise<number|null>{try{const token=await json<{exchange_rate?:string}>(`${blockscout}/tokens/0xdac17f958d2ee523a2206206994597c13d831ec7`),usd=Number(token.exchange_rate);return Number.isFinite(usd)&&usd>0?1/usd:null;}catch{return null;}}
