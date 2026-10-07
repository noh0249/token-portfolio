// Run against the initialized localhost preview only: node tests/privacy.integration.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const base='http://127.0.0.1:5173/api/';
const address='0x0000000000000000000000000000000000000001';
const otherAddress='0x0000000000000000000000000000000000000002';
async function call(path, body, method) {
 const r=await fetch(base+path,{method:method||(body!==undefined?'POST':'GET'),headers:{cookie:'__sites_local_auth=1',...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body!==undefined?JSON.stringify(body):undefined});
 return {status:r.status,headers:r.headers,data:await r.json()};
}
function sql(command) {
 const stdout=execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--command',command,'--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 return JSON.parse(stdout);
}

const initial=await call('portfolio');
assert.equal(initial.status,200);
assert.equal(initial.data.connections.length,0,'Use an empty local preview account; no existing connections will be touched.');
const ids=['privacy-legacy-fixture'];
try {
 sql(`INSERT INTO connections (id,user_id,type,label,address,created_at) VALUES ('privacy-legacy-fixture','local_seedy','ethereum','Legacy test wallet','${address}','2026-10-07T00:00:00Z')`);
 const migrated=await call('portfolio');
 assert.equal(migrated.status,200);
 assert.ok(!JSON.stringify(migrated.data).includes(address));
 assert.equal(migrated.headers.get('cache-control'),'private, no-store');
 const saved=await call('connections',{type:'ethereum',label:'New test wallet',address:otherAddress});
 assert.equal(saved.status,200);ids.push(saved.data.id);
 const row=sql(`SELECT COUNT(*) AS protected FROM connections WHERE user_id='local_seedy' AND type='ethereum' AND address IS NULL AND credentials IS NOT NULL AND instr(credentials,'${address}')=0 AND instr(credentials,'${otherAddress}')=0`);
 assert.equal(row[0].results[0].protected,2);
 const duplicate=await call('connections',{type:'ethereum',label:'Duplicate test wallet',address});
 assert.equal(duplicate.status,400,'Encrypted legacy addresses still prevent duplicates.');
 const publicData=await call('portfolio');
 assert.ok(publicData.data.connections.every(c=>!Object.hasOwn(c,'address')&&!Object.hasOwn(c,'credentials')&&!Object.hasOwn(c,'user_id')));
 for(const raw of [address,otherAddress])assert.ok(!JSON.stringify(publicData.data).includes(raw));
 const invalid=await call('connections',null);
 assert.equal(invalid.status,500);
 assert.deepEqual(invalid.data,{error:'요청을 처리할 수 없습니다. 잠시 후 다시 시도하세요.'});
 console.log('PASS: new and legacy wallet encryption, plaintext removal, private read payloads, encrypted duplicate detection, no-store and safe unexpected errors');
} finally {
 for(const id of ids)assert.equal((await call('connections?id='+encodeURIComponent(id),undefined,'DELETE')).status,200);
}
