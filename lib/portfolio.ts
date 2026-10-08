export type Category = 'bitcoin' | 'ethereum' | 'alt' | 'cash';
export type Asset = { symbol: string; name: string; amount: number; price: number | null; value: number | null; change24h: number | null; category: Category; sources: string[] };
export type Snapshot = { day: string; value: number; index: number; flow: number; recordedAt: string };
export type Connection = { id: string; type: 'binance' | 'upbit' | 'ethereum'; label: string; status: string; error?: string | null; lastSync?: string | null };
export type Portfolio = { mode: 'demo' | 'live'; assets: Asset[]; history: Snapshot[]; connections: Connection[]; updatedAt: string | null; warnings: string[]; profile: string; job?: { status: string; finishedAt: string } | null };
export const categories: Record<Category, { label: string; color: string }> = { bitcoin: { label: '비트코인', color: '#67cce7' }, ethereum: { label: '이더리움', color: '#afa0ef' }, alt: { label: '기타 알트', color: '#f4c478' }, cash: { label: '현금성 자산', color: '#99aecd' } };
export const coinNames: Record<string,string> = { BTC:'Bitcoin',ETH:'Ethereum',SOL:'Solana',USDT:'Tether',USDC:'USD Coin',BNB:'BNB',XRP:'XRP',ADA:'Cardano',DOGE:'Dogecoin',AVAX:'Avalanche',LINK:'Chainlink',DOT:'Polkadot',DAI:'Dai',KRW:'대한민국 원',FDUSD:'First Digital USD',SUI:'Sui',TRX:'TRON' };
export function classify(symbol:string):Category { return symbol==='BTC' || symbol==='WBTC' ? 'bitcoin' : symbol==='ETH' || symbol==='WETH' ? 'ethereum' : ['USDT','USDC','DAI','FDUSD','TUSD','USDP','PYUSD','USD1','KRW','USD','EUR'].includes(symbol) ? 'cash' : 'alt'; }
export const profiles: Record<string,{ label:string; description:string; weights:Record<Category,number> }> = {
  cautious:{label:'현금 확보형',description:'가격 변동에 대비해 현금성 자산을 더 많이 확보하는 참고 모델',weights:{bitcoin:35,ethereum:15,alt:10,cash:40}},
  balanced:{label:'균형형',description:'비트코인을 중심으로 알트와 현금성 자산을 나누는 참고 모델',weights:{bitcoin:45,ethereum:20,alt:10,cash:25}},
  growth:{label:'성장 추구형',description:'가격 변동을 감수하며 코인 비중을 높이는 참고 모델',weights:{bitcoin:45,ethereum:25,alt:20,cash:10}},
};
export function totalValue(assets:Asset[]) { return assets.reduce((n,a)=>n+(a.value??0),0); }
export function allocation(assets:Asset[]) { const total=totalValue(assets); return Object.fromEntries(Object.keys(categories).map(c=>[c,total ? assets.filter(a=>a.category===c).reduce((n,a)=>n+(a.value??0),0)/total*100:0])) as Record<Category,number>; }
export function nextIndex(previous:Snapshot|undefined,value:number,flow:number) { if(!Number.isFinite(value)||!Number.isFinite(flow)||value<0)throw new RangeError('Invalid valuation');if(!previous || previous.value<=0)return 100; const factor=(value-flow)/previous.value;if(factor<0)throw new RangeError('Cash flow exceeds valuation');return previous.index*factor; }
export function koreaDay(time=Date.now()) { return new Date(time+9*3600000).toISOString().slice(0,10); }
export function demoPortfolio():Portfolio {
 const definitions:[string,number,number,number,string[]][]=[['BTC',0.68,84920.5,2.84,['Binance','Upbit']],['ETH',8.5,3248.62,1.92,['Binance','Ethereum']],['SOL',72,168.42,5.16,['Binance']],['USDT',25200,1,0.01,['Binance']],['USDC',5000,0.9998,-0.02,['Ethereum']],['XRP',1500,1.9236,-1.34,['Upbit']]];
 const assets=definitions.map(([symbol,amount,price,change24h,sources])=>({symbol,name:coinNames[symbol],amount,price,value:amount*price,change24h,category:classify(symbol),sources}));
 const total=totalValue(assets),today=Date.now();
 const history=Array.from({length:90},(_,i)=>{const trend=.87+.13*i/89;const wiggle=i===89?0:Math.sin(i*.5)*.012+Math.cos(i*.23)*.009;const value=total*(trend+wiggle);return {day:koreaDay(today-(89-i)*86400000),value,index:value/(total*.879)*100,flow:0,recordedAt:new Date(today-(89-i)*86400000).toISOString()};});
 return {mode:'demo',assets,history,connections:[],updatedAt:null,warnings:[],profile:'balanced'};
}
