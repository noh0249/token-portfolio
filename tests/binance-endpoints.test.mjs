import { test } from 'node:test';
import assert from 'node:assert/strict';
import { binanceEndpoint } from '../lib/binance-errors.ts';

async function probe(responses) {
  const calls=[];
  const original=console.warn;
  console.warn=()=>{};
  try {
    const endpoint=await binanceEndpoint(async(url,init)=>{
      calls.push({url,init});
      const next=responses.shift();
      if(next instanceof Error)throw next;
      assert.ok(next,'Unexpected extra request');
      return next;
    });
    return {endpoint,calls};
  } finally { console.warn=original; }
}
const time=()=>Response.json({serverTime:1791467000000});
test('availability checks never send credentials and account uses the selected official origin',async()=>{
  const {endpoint,calls}=await probe([time()]);
  assert.deepEqual(endpoint,{baseUrl:'https://api-gcp.binance.com',serverTime:1791467000000});
  assert.equal(calls[0].url,'https://api-gcp.binance.com/api/v3/time');
  assert.equal(calls[0].init.headers,undefined);
  assert.equal(calls[0].init.redirect,'manual');
});
test('public WAF or network failures can use a bounded official alternative',async()=>{
  const {endpoint,calls}=await probe([new Response('blocked',{status:403}),new Error('offline'),time()]);
  assert.equal(endpoint.baseUrl,'https://api1.binance.com');
  assert.equal(calls.length,3);
  assert.ok(calls.every(({url})=>/^https:\/\/(api-gcp|api|api1)\.binance\.com\/api\/v3\/time$/.test(url)));
});
test('regional restrictions, rate limits and authentication errors stop without failover',async()=>{
  for(const status of [451,418,429,401]){
    const {endpoint,calls}=await probe([new Response('{}',{status})]);
    assert.ok('error' in endpoint);
    assert.equal(calls.length,1);
  }
  for(const response of [Response.json({code:-1003},{status:403}),new Response('blocked',{status:403,headers:{'Retry-After':'60'}})]){
    const {calls}=await probe([response]);assert.equal(calls.length,1);
  }
});
test('invalid server time never produces a signed account request',async()=>{
  for(const body of [{serverTime:'1791467000000'},{serverTime:-1},{serverTime:null}]){
    const {endpoint,calls}=await probe([Response.json(body)]);
    assert.ok('error' in endpoint);assert.equal(calls.length,1);
  }
});
