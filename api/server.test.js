import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opengym-api-qa-'));
const secret = crypto.randomBytes(32).toString('hex');
let child, base;
const cookie = id => { const payload = `${id}:${Date.now()+60000}:0`; return 'gymsid='+payload+'.'+crypto.createHmac('sha256',secret).update(payload).digest('base64url'); };
const state = { routines: [{ id: 'qa-A', name: 'QA A routine', ex: [] }], bodyweight: [{ d: '2026-10-05', w: 81 }], workouts: [], _ts: 1234 };
const request = (method, body, id = 'qa-A', route = '/api/data') => fetch(base+route, { method, headers: { 'Content-Type':'application/json', cookie:cookie(id) }, ...(body === undefined ? {} : {body:typeof body === 'string' ? body : JSON.stringify(body)}) });
async function freePort() { const s = net.createServer(); await new Promise(r=>s.listen(0,'127.0.0.1',r)); const p=s.address().port; await new Promise(r=>s.close(r)); return p; }
before(async () => {
  fs.writeFileSync(path.join(root,'secret'),secret);
  fs.writeFileSync(path.join(root,'db.json'),JSON.stringify({users:[{id:'qa-A',name:'QA A'},{id:'qa-B',name:'QA B'}],creds:[],subs:[],invites:[]}));
  const port = await freePort(); base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['server.js'],{cwd:import.meta.dirname,env:{...process.env,PORT:String(port),DATA_DIR:root},stdio:['ignore','pipe','pipe']});
  let errors=''; child.stderr.on('data',d=>{errors+=d});
  await new Promise((resolve,reject)=>{ const tm=setTimeout(()=>reject(new Error('startup timeout '+errors)),10000); child.stdout.on('data',()=>{clearTimeout(tm);resolve()}); child.on('exit',()=>{clearTimeout(tm);reject(new Error('startup exited '+errors))}); });
});
after(async () => { if(child) { child.kill(); await new Promise(r=>child.once('exit',r)); } fs.rmSync(root,{recursive:true,force:true}); });

test('HTTP health and unauthenticated private data',async()=>{ assert.equal((await fetch(base+'/api/health')).status,200); assert.equal((await fetch(base+'/api/data')).status,401); });
test('captured malformed JSON is client error and runtime stays healthy',async()=>{ const r=await request('PUT','{"state":'); assert.equal(r.status,400); assert.equal((await fetch(base+'/api/health')).status,200); });
test('oversized body returns 413 and JSON primitives return 400',async()=>{
  assert.equal((await request('PUT',JSON.stringify({ state: { note: 'x'.repeat(5*1024*1024) } }))).status,413);
  for(const body of ['null','[]','3']) assert.equal((await request('PUT',body)).status,400);
});
test('arrays and malformed collections are rejected before persistence',async()=>{ for(const state of [[],{routines:{}},{workouts:'wrong'},{bodyweight:[null]},{week:[]},{workouts:[{entries:{}}]},{routines:[{}]},{workouts:[{entries:[{id:'qa',sets:{}}]}]}]) { const r=await request('PUT',{state,baseRevision:0,ownerId:'qa-A'}); assert.equal(r.status,400,JSON.stringify(state)); } });
test('real HTTP revision CAS rejects second device and cross-profile owner',async()=>{
  const first=await request('PUT',{state,baseRevision:0,ownerId:'qa-A'}); assert.equal(first.status,200); const saved=await first.json(); assert.equal(saved.revision,1);
  const stale=await request('PUT',{state:{...state,targetW:72},baseRevision:0,ownerId:'qa-A'}); assert.equal(stale.status,409);
  const wrong=await request('PUT',{state,baseRevision:0,ownerId:'qa-A'},'qa-B'); assert.equal(wrong.status,409);
  const read=await (await request('GET')).json(); assert.deepEqual(read.state,state); assert.equal(read.revision,1);
  assert.equal((await (await request('GET',undefined,'qa-B')).json()).state,null);
  console.log('TRACE qa-A GET revision=0 -> PUT owner=qa-A base=0 revision=1 -> stale PUT 409 -> owner/cookie mismatch 409 -> GET preserved -> qa-B null');
});
test('private/non-HTTPS push endpoint is refused before network',async()=>{ const r=await request('POST',{subscription:{endpoint:'http://127.0.0.1:3000/api/health',keys:{p256dh:'x',auth:'x'}}},'qa-A','/api/push/subscribe'); assert.equal(r.status,400); });
test('existing corrupted DB fails closed and retains bytes',async()=>{
  const dir=fs.mkdtempSync(path.join(root,'corrupt-')); const db=path.join(dir,'db.json'); fs.writeFileSync(db,'{"users":');
  const p=spawn(process.execPath,['server.js'],{cwd:import.meta.dirname,env:{...process.env,PORT:String(await freePort()),DATA_DIR:dir},stdio:'ignore'});
  const result=await new Promise(resolve=>{
    const timer=setTimeout(()=>{p.kill();resolve('still-running')},10000);
    p.once('exit',code=>{clearTimeout(timer);resolve(code)});
  });
  assert.notEqual(result,'still-running'); assert.notEqual(result,0); assert.equal(fs.readFileSync(db,'utf8'),'{"users":');
});
