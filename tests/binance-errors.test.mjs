import { test } from 'node:test';
import assert from 'node:assert/strict';
import { binanceFailure, binanceTransportFailure } from '../lib/binance-errors.ts';

async function failure(status, body, stage='account') {
  const logs=[];
  const original=console.warn;
  console.warn=(...values)=>logs.push(values.join(' '));
  try { return {message:await binanceFailure(new Response(body,{status}),stage),logs}; }
  finally { console.warn=original; }
}
test('public time rejection is identified before any API key is used',async()=>{
  const {message,logs}=await failure(403,'<html>blocked</html>','time');
  assert.match(message,/API 키 없이/);assert.match(message,/HTTP 403/);
  assert.match(logs[0],/"stage":"time"/);assert.doesNotMatch(message,/키의 활성 상태/);
});
test('Binance numeric codes distinguish key rejection and invalid signatures',async()=>{
  assert.match((await failure(401,'{"code":-2015,"msg":"rejected"}')).message,/-2015/);
  assert.match((await failure(400,'{"code":-1022,"msg":"invalid"}')).message,/동일한 HMAC/);
  assert.match((await failure(400,'{"code":-1021}')).message,/요청 시간/);
});
test('account WAF rejection and regional restriction have separate guidance',async()=>{
  assert.match((await failure(403,'blocked')).message,/방화벽/);
  assert.match((await failure(451,'{"code":0}')).message,/배포 지역/);
});
test('rate limiting does not invite repeated authentication retries',async()=>{
  assert.match((await failure(429,'{}')).message,/요청 한도/);
  assert.match((await failure(418,'{}')).message,/요청 한도/);
});
test('provider messages and credentials cannot enter diagnostics',async()=>{
  const marker='private-fixture-value';
  const {message,logs}=await failure(401,JSON.stringify({code:-2015,msg:marker,apiKey:marker,secret:marker,address:marker}));
  assert.ok(!JSON.stringify({message,logs}).includes(marker));
  assert.deepEqual(JSON.parse(logs[0].replace('Coinfolio provider failure ','')),{provider:'binance',stage:'account',status:401,code:-2015});
});
test('untrusted or oversized error codes cannot be reflected',async()=>{
  const marker='private-fixture-value';
  for(const body of [JSON.stringify({code:marker,msg:marker}),JSON.stringify({code:-2015,msg:marker.repeat(500)})]){
    const {message,logs}=await failure(401,body);assert.ok(!JSON.stringify({message,logs}).includes(marker));assert.match(logs[0],/"code":null/);
  }
});
test('transport exceptions only expose a fixed failure category',()=>{
  const logs=[],original=console.warn,marker='private-fixture-value';
  console.warn=(...values)=>logs.push(values.join(' '));
  try {
    const message=binanceTransportFailure(new Error(`redirect failed with ${marker}`),'time');
    assert.match(message,/network: redirect/);
    assert.ok(!JSON.stringify({message,logs}).includes(marker));
  } finally { console.warn=original; }
});
