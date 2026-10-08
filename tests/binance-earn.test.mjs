import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileBinanceEarn } from '../lib/binance-earn.ts';

test('Earn receipts use verified underlying amounts and are never counted twice',()=>{
  const result=reconcileBinanceEarn([{symbol:'BTC',amount:0.25},{symbol:'LDBTC',amount:99},{symbol:'LDUSDC',amount:200}], [{asset:'BTC',totalAmount:'0.5',productId:'BTC001'},{asset:'USDC',totalAmount:'201.2',productId:'USDC001'}]);
  assert.deepEqual(result,[{symbol:'BTC',amount:0.75},{symbol:'USDC',amount:201.2}]);
});
test('unverified receipts and unrelated spot assets remain visible',()=>{
  const spot=[{symbol:'LDBTC',amount:1},{symbol:'LDUNKNOWN',amount:2},{symbol:'LDO',amount:3}];
  assert.deepEqual(reconcileBinanceEarn(spot,[]),spot);
});
test('Earn products for the same underlying are aggregated exactly once',()=>{
  assert.deepEqual(reconcileBinanceEarn([{symbol:'LDUSDT',amount:10}], [{asset:'USDT',totalAmount:'8',productId:'USDT001'},{asset:'USDT',totalAmount:'3',productId:'USDT002'}]),[{symbol:'USDT',amount:11}]);
});
test('duplicate or invalid Earn positions cannot manufacture a valuation',()=>{
  const position={asset:'BTC',totalAmount:'1',productId:'BTC001'};
  assert.throws(()=>reconcileBinanceEarn([],[position,position]));
  for(const totalAmount of ['NaN','-1','',null])assert.throws(()=>reconcileBinanceEarn([],[{...position,totalAmount}]));
});
