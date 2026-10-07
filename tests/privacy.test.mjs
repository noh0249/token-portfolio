import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicConnection, redactAddresses } from '../lib/privacy.ts';

const address='0x0000000000000000000000000000000000000001';
test('browser connection payload excludes addresses, credentials and owner identity',()=>{
 const row={id:'fixture',type:'ethereum',label:'Main wallet',status:'ok',error:null,last_sync:null,address,credentials:'ciphertext',user_id:'private-owner',balances:'[]'};
 const result=publicConnection(row);
 assert.deepEqual(Object.keys(result).sort(),['error','id','label','lastSync','status','type']);
 const json=JSON.stringify(result);
 for(const privateValue of [address,'ciphertext','private-owner'])assert.ok(!json.includes(privateValue));
});
test('legacy labels and errors cannot reintroduce a raw wallet address',()=>{
 const result=publicConnection({id:'fixture',type:'ethereum',label:`Wallet ${address}`,status:'error',error:`RPC failed for ${address}`,last_sync:null});
 assert.ok(!JSON.stringify(result).includes(address));
 assert.equal(result.label,'Wallet [private wallet]');
});
test('cached source names and warning strings redact all complete addresses',()=>{
 const other='0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
 assert.equal(redactAddresses(`${address}: error for ${other}`),'[private wallet]: error for [private wallet]');
 assert.equal(redactAddresses('My exchange: previous balances retained'),'My exchange: previous balances retained');
});
