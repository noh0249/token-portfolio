import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dexQuote, indexedNfts, indexedTokens, nftFloor, safeImageUrl, tokenAmount } from '../lib/wallet-data.ts';
import { assetKey, allocation, nextIndex, visibleAsset } from '../lib/portfolio.ts';
const contract='0x0000000000000000000000000000000000000001',other='0x0000000000000000000000000000000000000002';
const token=(address,symbol='USDT')=>({token:{address_hash:address,type:'ERC-20',symbol,name:'Fixture token',decimals:'6',reputation:'ok'},value:'1234567'});
test('same-symbol tokens stay distinct and imitation stablecoins are not trusted',()=>{
 const tokens=indexedTokens([token(contract),token(other)]);assert.notEqual(tokens[0].identity,tokens[1].identity);assert.equal(tokens[0].trusted,false);assert.equal(tokens[0].amount,1.234567);
 const real=indexedTokens([token('0xdac17f958d2ee523a2206206994597c13d831ec7')])[0];assert.equal(real.trusted,true);assert.equal(real.identity,'USDT');assert.throws(()=>indexedTokens([token(contract),token(contract)]));
});
test('on-chain decimals apply once and malformed balances fail safely',()=>{
 assert.equal(tokenAmount('7',0),7);assert.equal(tokenAmount('5000000','6'),5);
 for(const [raw,d] of [['0x1',18],['1',null],['1',''],['1',-1],['1',37],['-1',0],['1e20',6]])assert.throws(()=>tokenAmount(raw,d));
});
test('NFT quantities and IDs are validated and metadata cannot reveal wallet addresses',()=>{
 const nft={id:'0042',image_url:'ipfs://bafyexample/art.png',metadata:{name:`Art ${other}`},token:{address_hash:contract,type:'ERC-1155',name:'Fixture art',reputation:'ok'},value:'3'};
 const result=indexedNfts([nft]);assert.equal(result[0].tokenId,'42');assert.equal(result[0].amount,3);assert.ok(!result[0].name.includes(other));assert.equal(result[0].imageUrl,'https://ipfs.io/ipfs/bafyexample/art.png');assert.throws(()=>indexedNfts([nft,{...nft,id:'42'}]));assert.equal(indexedNfts([{...nft,token:{...nft.token,reputation:'scam'}}]).length,0);
});
test('DEX quotes use the correct chain, base contract and a liquid pool',()=>{
 const pair={chainId:'ethereum',baseToken:{address:contract},priceUsd:'2',liquidity:{usd:10000},volume:{h24:200},priceChange:{h24:3}};
 assert.deepEqual(dexQuote(contract,[{...pair,priceUsd:'999',liquidity:{usd:1}},pair]),{usd:2,change:3,image:null});assert.equal(dexQuote(other,[pair]),null);assert.equal(dexQuote(contract,[{...pair,chainId:'base'}]),null);assert.equal(dexQuote(contract,[{...pair,volume:{h24:0}}]),null);
});
test('NFT floor prices require a positive quote and an explicit supported currency',()=>{
 assert.deepEqual(nftFloor({total:{floor_price:.5,floor_price_symbol:'ETH'}}),{amount:.5,currency:'ETH'});
 for(const total of [{floor_price:5},{floor_price:0,floor_price_symbol:'ETH'},{floor_price:NaN,floor_price_symbol:'ETH'},{floor_price:99,floor_price_symbol:'UNKNOWN'},{floor_price:'0.5',floor_price_symbol:'ETH'}])assert.equal(nftFloor({total}),null);
});
test('image sources cannot use local hosts, credentials or executable URL schemes',()=>{
 for(const url of ['http://127.0.0.1/a.png','https://localhost/a','https://169.254.169.254/','data:image/svg+xml,anything','javascript:alert(1)','https://user:secret@i.seadn.io/a','https://i.seadn.io.evil.example/a'])assert.equal(safeImageUrl(url),null);
 assert.equal(safeImageUrl('https://i.seadn.io/a.png'),'https://i.seadn.io/a.png');
});
test('NFTs worth exactly 5 USDT are shown while dust and unpriced wallet tokens stay hidden',()=>{
 const asset={symbol:'NFT',kind:'nft',amount:1,value:5,price:5,category:'nft',sources:[],name:'Art'};
 assert.equal(visibleAsset(asset),true);assert.equal(visibleAsset({...asset,value:4.999}),false);assert.equal(visibleAsset({...asset,value:null}),false);assert.equal(visibleAsset({...asset,kind:'token'}),false);assert.equal(visibleAsset({...asset,kind:'token',value:null,origin:'wallet'}),false);assert.notEqual(assetKey({...asset,id:'one'}),assetKey({...asset,id:'two'}));assert.equal(allocation([asset]).nft,100);
});
test('new valuation coverage preserves the return index and future price changes compound',()=>{
 const previous={day:'2026-10-08',value:1000,index:110,flow:0,recordedAt:'',basis:'coins-v1'};
 assert.equal(nextIndex(previous,5000,0,'wallet-v2:nft'),110);assert.ok(Math.abs(nextIndex({...previous,value:5000,basis:'wallet-v2:nft'},5500,0,'wallet-v2:nft')-121)<1e-10);
});
