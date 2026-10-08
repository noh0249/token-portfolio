import type { Balance } from './exchanges';
export const trustedTokens: Record<string, string> = {
 '0xdac17f958d2ee523a2206206994597c13d831ec7':'USDT','0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48':'USDC','0x6b175474e89094c44da98b954eedeac495271d0f':'DAI','0x2260fac5e5542a773aa44fbcfedf7c193bc2c599':'WBTC','0x514910771af9ca656af840dff83e8264ecf986ca':'LINK','0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2':'WETH',
};
const clean=(value:unknown,fallback:string,max=100)=>typeof value==='string'?value.replace(/0x[a-fA-F0-9]{40}/g,'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max)||fallback:fallback;
export function tokenAmount(raw:unknown,decimals:unknown):number {
 const digits=Number(decimals);
 if(typeof raw!=='string'||!/^\d{1,80}$/.test(raw)||!['string','number'].includes(typeof decimals)||(typeof decimals==='string'&&!/^\d{1,2}$/.test(decimals))||!Number.isInteger(digits)||digits<0||digits>36)throw Error('Invalid token amount');
 const value=raw.padStart(digits+1,'0'),amount=Number(digits?`${value.slice(0,-digits)}.${value.slice(-digits)}`:value);
 if(!Number.isFinite(amount)||amount<0)throw Error('Invalid token amount');return amount;
}
export function safeImageUrl(raw:unknown):string|null {
 if(typeof raw!=='string'||raw.length>2000)return null;
 if(raw.startsWith('ipfs://'))raw='https://ipfs.io/ipfs/'+raw.slice(7).replace(/^ipfs\//,'');
 try {
  const url=new URL(raw as string),host=url.hostname.toLowerCase();
  const exact=['i.seadn.io','ipfs.io','gateway.pinata.cloud','cloudflare-ipfs.com','arweave.net','res.cloudinary.com','assets.coingecko.com','coin-images.coingecko.com','ipfs.filebase.io','ipfs.nftstorage.link','nftstorage.link','storage.googleapis.com','dd.dexscreener.com'];
  const allowed=exact.includes(host)||host.endsWith('.seadn.io')||host.endsWith('.mypinata.cloud')||host.endsWith('.nftstatic.com')||host.endsWith('.blockscout.com')||host.endsWith('.ipfs.dweb.link')||host.endsWith('.s3.amazonaws.com');
  if(url.protocol!=='https:'||url.username||url.password||url.port||!allowed)return null;return url.href;
 }catch{return null;}
}
export type IndexedToken={token:{address_hash:string;type:string;symbol?:string;name?:string;decimals?:string;reputation?:string;icon_url?:string;exchange_rate?:string};value:string};
export function indexedTokens(rows:IndexedToken[]):Balance[] {
 const seen=new Set<string>(),balances:Balance[]=[];
 for(const row of rows){
  const token=row.token,contract=token?.address_hash?.toLowerCase();
  if(token?.type!=='ERC-20'||token.reputation==='scam'||!/^0x[a-f0-9]{40}$/.test(contract??''))continue;
  if(seen.has(contract))throw Error('Duplicate token contract');seen.add(contract);
  const amount=tokenAmount(row.value,token.decimals);if(!amount)continue;
  const symbol=trustedTokens[contract]||clean(token.symbol,'TOKEN',20),usd=Number(token.exchange_rate);
  balances.push({symbol,amount,identity:trustedTokens[contract]?symbol:`erc20:ethereum:${contract}`,kind:'token',contract,name:clean(token.name,symbol),imageUrl:safeImageUrl(token.icon_url)??undefined,quoteUsd:Number.isFinite(usd)&&usd>0?usd:undefined,trusted:!!trustedTokens[contract]});
 }
 return balances;
}
export type IndexedNft={id:string;value?:string;image_url?:string;media_url?:string;metadata?:{name?:string;image?:string};token:{address_hash:string;type:string;name?:string;symbol?:string;reputation?:string}};
export function indexedNfts(rows:IndexedNft[]):Balance[] {
 const seen=new Set<string>(),balances:Balance[]=[];
 for(const row of rows){
  const token=row.token,contract=token?.address_hash?.toLowerCase();
  if(!['ERC-721','ERC-1155'].includes(token?.type)||token.reputation==='scam'||!/^0x[a-f0-9]{40}$/.test(contract??'')||!/^\d{1,78}$/.test(row.id??''))continue;
  const tokenId=BigInt(row.id).toString(),identity=`nft:ethereum:${contract}:${tokenId}`;
  if(seen.has(identity))throw Error('Duplicate NFT');seen.add(identity);
  const amount=token.type==='ERC-721'?1:tokenAmount(row.value??'0',0);if(!Number.isSafeInteger(amount)||amount<=0)continue;
  balances.push({symbol:'NFT',amount,identity,kind:'nft',contract,tokenId,name:clean(row.metadata?.name,`${clean(token.name,'NFT')} #${tokenId}`),collection:clean(token.name,'NFT'),imageUrl:safeImageUrl(row.image_url??row.media_url??row.metadata?.image)??undefined});
 }
 return balances;
}
export type DexPair={chainId:string;baseToken:{address:string};priceUsd?:string;liquidity?:{usd?:number};volume?:{h24?:number};priceChange?:{h24?:number};info?:{imageUrl?:string}};
export function dexQuote(contract:string,pairs:DexPair[]):{usd:number;change:number|null;image:string|null}|null {
 const pair=pairs.filter(p=>p.chainId==='ethereum'&&p.baseToken?.address?.toLowerCase()===contract.toLowerCase()&&Number(p.priceUsd)>0&&Number.isFinite(Number(p.priceUsd))&&(p.liquidity?.usd??0)>=1000&&(p.volume?.h24??0)>0).sort((a,b)=>(b.liquidity?.usd??0)-(a.liquidity?.usd??0))[0];
 return pair?{usd:Number(pair.priceUsd),change:typeof pair.priceChange?.h24==='number'&&Number.isFinite(pair.priceChange.h24)?pair.priceChange.h24:null,image:safeImageUrl(pair.info?.imageUrl)}:null;
}
export function nftFloor(stats:unknown):{amount:number;currency:string}|null {
 const total=(stats as {total?:{floor_price?:unknown;floor_price_symbol?:unknown}})?.total;
 if(typeof total?.floor_price!=='number'||!Number.isFinite(total.floor_price)||total.floor_price<=0||typeof total.floor_price_symbol!=='string'||!['ETH','WETH','USDT','USDC','USD','DAI'].includes(total.floor_price_symbol.toUpperCase()))return null;
 return {amount:total.floor_price,currency:total.floor_price_symbol.toUpperCase()};
}
