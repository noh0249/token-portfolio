import { base64url, hex, hmac } from './crypto';
export type Balance={symbol:string;amount:number};
export class ProviderError extends Error { constructor(message:string){super(message);} }
async function request<T>(url:string,init?:RequestInit):Promise<T>{let r:Response;try{r=await fetch(url,{...init,signal:AbortSignal.timeout(12000)});}catch{throw new ProviderError('네트워크 연결에 실패했습니다. 잠시 후 다시 동기화하세요.');}if(!r.ok){if(r.status===401||r.status===403)throw new ProviderError('API 키, 잔고 조회 권한과 허용 IP를 확인하세요.');if(r.status===418||r.status===429)throw new ProviderError('거래소 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.');if(r.status===451)throw new ProviderError('현재 서버 지역에서 거래소 접근이 제한됩니다.');throw new ProviderError(`잔고 조회에 실패했습니다 (${r.status}). 연결 설정을 확인하세요.`);}return await r.json() as T;}
export async function binanceBalances(apiKey:string,secret:string):Promise<Balance[]>{
 const {serverTime}=await request<{serverTime:number}>('https://api.binance.com/api/v3/time');
 const params=`timestamp=${serverTime}&recvWindow=10000&omitZeroBalances=true`,signature=hex(await hmac(secret,params));
 const result=await request<{balances:{asset:string;free:string;locked:string}[];canTrade?:boolean;canWithdraw?:boolean}>(`https://api.binance.com/api/v3/account?${params}&signature=${signature}`,{headers:{'X-MBX-APIKEY':apiKey}});
 if(!Array.isArray(result.balances))throw new ProviderError('거래소가 올바른 잔고를 반환하지 않았습니다.');
 return result.balances.map(b=>({symbol:b.asset,amount:Number(b.free)+Number(b.locked)})).filter(b=>Number.isFinite(b.amount)&&b.amount>0);
}
export async function upbitBalances(apiKey:string,secret:string):Promise<Balance[]>{
 const header=base64url(JSON.stringify({alg:'HS512',typ:'JWT'})),payload=base64url(JSON.stringify({access_key:apiKey,nonce:crypto.randomUUID()}));
 const token=`${header}.${payload}.${base64url(await hmac(secret,`${header}.${payload}`,'SHA-512'))}`;
 const result=await request<{currency:string;balance:string;locked:string}[]>('https://api.upbit.com/v1/accounts',{headers:{Authorization:`Bearer ${token}`}});
 if(!Array.isArray(result))throw new ProviderError('거래소가 올바른 잔고를 반환하지 않았습니다.');
 return result.map(b=>({symbol:b.currency,amount:Number(b.balance)+Number(b.locked)})).filter(b=>Number.isFinite(b.amount)&&b.amount>0);
}
export const tokenContracts=[
 {symbol:'USDT',address:'0xdAC17F958D2ee523a2206206994597C13D831ec7',decimals:6},
 {symbol:'USDC',address:'0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',decimals:6},
 {symbol:'DAI',address:'0x6B175474E89094C44Da98b954EedeAC495271d0F',decimals:18},
 {symbol:'WBTC',address:'0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',decimals:8},
 {symbol:'LINK',address:'0x514910771AF9Ca656af840dff83E8264EcF986CA',decimals:18},
];
export async function ethereumBalances(address:string):Promise<Balance[]>{
 if(!/^0x[a-fA-F0-9]{40}$/.test(address))throw new ProviderError('올바른 이더리움 주소를 입력하세요.');
 const rpc=[{jsonrpc:'2.0',id:0,method:'eth_getBalance',params:[address,'latest']},...tokenContracts.map((t,i)=>({jsonrpc:'2.0',id:i+1,method:'eth_call',params:[{to:t.address,data:`0x70a08231${address.slice(2).padStart(64,'0')}`},'latest']}))];
 const result=await request<{id:number;result?:string;error?:unknown}[]>('https://ethereum-rpc.publicnode.com',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(rpc)});
 if(!Array.isArray(result)||result.length!==rpc.length||result.some(r=>r.error||!r.result))throw new ProviderError('지갑 잔고의 일부를 조회하지 못했습니다. 다시 시도하세요.');
 return result.map(r=>({symbol:r.id===0?'ETH':tokenContracts[r.id-1].symbol,amount:Number(BigInt(r.result!))/10**(r.id===0?18:tokenContracts[r.id-1].decimals)})).filter(b=>b.amount>0);
}
