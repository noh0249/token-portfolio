import { runtime } from './storage';
const ids:Record<string,string>={BTC:'bitcoin',WBTC:'wrapped-bitcoin',ETH:'ethereum',WETH:'weth',SOL:'solana',USDT:'tether',USDC:'usd-coin',DAI:'dai',BNB:'binancecoin',XRP:'ripple',ADA:'cardano',DOGE:'dogecoin',AVAX:'avalanche-2',LINK:'chainlink',DOT:'polkadot',SUI:'sui',TRX:'tron',TON:'the-open-network',UNI:'uniswap',LTC:'litecoin',BCH:'bitcoin-cash',AAVE:'aave',NEAR:'near',APT:'aptos',ARB:'arbitrum',OP:'optimism',FDUSD:'first-digital-usd',TUSD:'true-usd',USDP:'paxos-standard',PYUSD:'paypal-usd'};
type Price={price:number;change:number|null};
async function json<T>(url:string,headers?:Record<string,string>):Promise<T>{const r=await fetch(url,{headers:{Accept:'application/json',...headers},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error(`시세 조회가 실패했습니다 (${r.status}).`);return await r.json() as T;}
export async function pricesFor(symbols:string[]):Promise<Record<string,Price>>{
 const prices:Record<string,Price>={USDT:{price:1,change:0}};
 const results=await Promise.allSettled([
  json<{symbol:string;lastPrice:string;priceChangePercent:string}[]>('https://data-api.binance.vision/api/v3/ticker/24hr'),
  json<Record<string,{usd?:number;krw?:number;eur?:number;usd_24h_change?:number}>>(`https://api.coingecko.com/api/v3/simple/price?ids=${Array.from(new Set(['tether',...symbols.map(s=>ids[s]).filter(Boolean)])).join(',')}&vs_currencies=usd,krw,eur&include_24hr_change=true`,runtime().COINGECKO_API_KEY?{'x-cg-demo-api-key':runtime().COINGECKO_API_KEY!}:undefined),
  symbols.includes('KRW')?json<{trade_price:number}[]>('https://api.upbit.com/v1/ticker?markets=KRW-USDT'):Promise.resolve([]),
 ]);
 const binance=results[0];if(binance.status==='fulfilled'&&Array.isArray(binance.value))for(const s of symbols){const tick=binance.value.find(t=>t.symbol===`${s}USDT`);if(tick&&Number(tick.lastPrice)>0)prices[s]={price:Number(tick.lastPrice),change:Number(tick.priceChangePercent)};}
 const cg=results[1];if(cg.status==='fulfilled'){const usd=cg.value.tether?.usd;if(usd&&usd>0){for(const s of symbols){const entry=cg.value[ids[s]];if(!prices[s]&&entry?.usd&&entry.usd>0)prices[s]={price:entry.usd/usd,change:entry.usd_24h_change??null};}if(cg.value.tether.krw)prices.KRW={price:1/cg.value.tether.krw,change:null};if(cg.value.tether.eur)prices.EUR={price:1/cg.value.tether.eur,change:null};prices.USD={price:1/usd,change:null};}}
 const krw=results[2];if(krw.status==='fulfilled'&&krw.value[0]?.trade_price>0)prices.KRW={price:1/krw.value[0].trade_price,change:null};
 // Convert Korean-exchange-only assets through their KRW quotes, without inventing a price.
 if(symbols.some(s=>!prices[s])){const fallback=await json<{data:{currency:string;rates:Record<string,string>}}>('https://api.coinbase.com/v2/exchange-rates?currency=USDT').catch(()=>null);if(fallback?.data.currency==='USDT')for(const s of symbols){const rate=Number(fallback.data.rates[s]);if(!prices[s]&&Number.isFinite(rate)&&rate>0)prices[s]={price:1/rate,change:null};}}
 const missing=symbols.filter(s=>!prices[s]&&/^[A-Z0-9]{1,15}$/.test(s));
 if(missing.length&&prices.KRW){const markets=await json<{market:string}[]>('https://api.upbit.com/v1/market/all').catch(()=>[]);const valid=missing.filter(s=>markets.some(m=>m.market===`KRW-${s}`));if(valid.length){const quotes=await json<{market:string;trade_price:number;signed_change_rate:number}[]>(`https://api.upbit.com/v1/ticker?markets=${valid.map(s=>`KRW-${s}`).join(',')}`).catch(()=>[]);for(const q of quotes)prices[q.market.slice(4)]={price:q.trade_price*prices.KRW.price,change:q.signed_change_rate*100};}}
 return prices;
}
