import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.QA_PLAYWRIGHT || 'C:/Users/jader/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'reports');
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'opengym-browser-qa-'));
const base = 'http://localhost:5173';
const events = [], checks = [], children = [];
let browser, media;
fs.mkdirSync(out, { recursive: true });
const log = value => { console.log(value); events.push(value); };
const check = (name, details = '') => { checks.push({ name, status:'PASS', details }); log('PASS '+name+(details ? ' — '+details : '')); };
async function available(port) { const s=net.createServer(); await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(port,'127.0.0.1',resolve)}); await new Promise(r=>s.close(r)); }
async function healthy(url) { const limit=Date.now()+20000; while(Date.now()<limit) { try { if((await fetch(url)).ok) return; } catch {} await new Promise(r=>setTimeout(r,150)); } throw new Error('health timeout '+url); }
function start(command,args,cwd,env) { const p=spawn(command,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe']}); p.stdout.on('data',d=>events.push(String(d)));p.stderr.on('data',d=>events.push(String(d)));children.push(p);return p; }
async function api(page, route, method='GET', body) { return page.evaluate(async ({route,method,body})=>{ const r=await fetch(route,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});return {status:r.status,body:await r.json().catch(()=>null)}; },{route,method,body}); }
async function virtual(page) { const cdp=await page.context().newCDPSession(page); await cdp.send('WebAuthn.enable'); const {authenticatorId}=await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});return {cdp,authenticatorId}; }
async function register(page,name) { await page.goto(base);await page.getByRole('button',{name:'Create new profile',exact:true}).click();await page.getByPlaceholder('Your name').fill(name);await page.getByRole('button',{name:'Create passkey',exact:true}).click();await page.getByRole('heading',{name:'Hi '+name,exact:true}).waitFor();const me=await api(page,'/api/me');assert.equal(me.status,200);assert.equal(me.body.user.name,name);return me.body.user; }
async function signout(page) { await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByText('Sign out',{exact:true}).click();await page.locator('#modal-root').getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Sign in with passkey',exact:true}).waitFor();assert.equal((await api(page,'/api/me')).status,401); }
async function synced(page,predicate) { const limit=Date.now()+15000;let result;while(Date.now()<limit){result=await api(page,'/api/data');if(result.status===200&&predicate(result.body))return result.body;await new Promise(r=>setTimeout(r,150));}throw new Error('sync predicate timed out; status='+result?.status); }
async function stop(p){if(p.exitCode===null){p.kill();await new Promise(r=>p.once('exit',r));}}

try {
  await Promise.all([3000,5173,8888].map(available));
  let apiChild=start(process.execPath,['server.js'],path.join(root,'api'),{PORT:'3000',DATA_DIR:data,RP_ID:'localhost',ORIGIN:base});
  await healthy('http://localhost:3000/api/health');
  media=http.createServer((req,res)=>{const file=path.join(root,'media',decodeURIComponent(req.url||''));if(!file.startsWith(path.join(root,'media')+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':file.endsWith('.gif')?'image/gif':'image/jpeg'});fs.createReadStream(file).pipe(res)});await new Promise(r=>media.listen(8888,'127.0.0.1',r));
  start(process.execPath,['node_modules/vite/bin/vite.js','--host','localhost','--port','5173','--strictPort'],path.join(root,'frontend'),{API_TARGET:'http://127.0.0.1:3000',MEDIA_TARGET:'http://127.0.0.1:8888'});
  await healthy(base);
  const channel=process.env.QA_BROWSER_CHANNEL || (process.platform==='win32'?'chrome':undefined);
  browser=await chromium.launch({headless:true,...(channel?{channel}:{})});
  const a=await browser.newContext({viewport:{width:390,height:844}});const pa=await a.newPage();const va=await virtual(pa);const errors=[];pa.on('pageerror',e=>errors.push(e.message));
  const userA=await register(pa,'QA Browser A');check('UI registration + WebAuthn verification',`profile=${userA.id}; virtual authenticator, localhost secure-context exception`);
  await pa.screenshot({path:path.join(out,'qa-home.png'),fullPage:true});
  await pa.getByRole('button',{name:'Plan',exact:true}).click();await pa.getByRole('button',{name:'New',exact:true}).click();await pa.locator('input.input').fill('QA Browser routine');await pa.getByRole('button',{name:'Add exercise',exact:true}).click();
  fs.writeFileSync(path.join(out,'qa-page-inspection.txt'),await pa.locator('body').innerText());
  await pa.screenshot({path:path.join(out,'qa-exercise-picker.png'),fullPage:true});
  check('UI routine creation/rename opens exercise picker');
  if(process.env.QA_INSPECT==='1') { log('INSPECT pause runner after UI inspection'); }
  else {
    await pa.locator('.sheet').getByText(/^3\/4 sit-up$/i).click();await pa.getByRole('button',{name:'Add to routine',exact:true}).click();if(await pa.locator('.mback').count())await pa.locator('.mback').last().click({position:{x:3,y:3}});
    await pa.getByRole('button',{name:'Plan',exact:true}).first().click();await pa.getByText('Monday',{exact:true}).click();await pa.locator('.sheet').getByText('QA Browser routine',{exact:true}).click();
    await pa.getByRole('button',{name:'Home',exact:true}).click();await pa.getByRole('button',{name:'Log',exact:true}).click();await pa.getByRole('button',{name:'plus 0.1'}).click();await pa.getByRole('button',{name:'Save',exact:true}).click();
    let saved=await synced(pa,d=>d.state?.routines?.[0]?.ex?.length===1&&d.state?.bodyweight?.length===1);
    assert.equal(saved.state.routines[0].name,'QA Browser routine');assert.equal(saved.state.bodyweight[0].w,70.1);assert.equal(saved.state.week['1'],saved.state.routines[0].id);check('UI routine/exercise, weekly plan and weight create/save/read');
    await pa.getByRole('button',{name:'Log',exact:true}).click();await pa.getByRole('button',{name:'plus 0.1'}).click();await pa.getByRole('button',{name:'Save',exact:true}).click();await synced(pa,d=>d.state?.bodyweight?.[0]?.w===70.2);check('UI weight edit/read');
    await pa.getByRole('button',{name:'Start',exact:true}).first().click();
    if(!await pa.getByRole('button',{name:'Save & start workout',exact:true}).count()){
      if(await pa.getByRole('button',{name:'Start QA Browser routine',exact:true}).count())await pa.getByRole('button',{name:'Start QA Browser routine',exact:true}).click();
      else if(await pa.getByText('QA Browser routine',{exact:true}).count())await pa.getByText('QA Browser routine',{exact:true}).first().click();
    }
    await pa.getByRole('button',{name:'Save & start workout',exact:true}).click();await pa.getByRole('checkbox').first().click();await pa.getByRole('button',{name:'Finish',exact:true}).click();await pa.locator('#modal-root').getByRole('button',{name:'Finish workout',exact:true}).click();await pa.getByRole('button',{name:'Nice!',exact:true}).click();
    saved=await synced(pa,d=>d.state?.workouts?.length===1);assert.equal(saved.state.workouts[0].entries[0].sets.filter(s=>s.done).length,1);assert.equal(saved.state.active,undefined);check('UI workout set/finish + authenticated persisted history');await pa.screenshot({path:path.join(out,'qa-workout-saved.png'),fullPage:true});
    await pa.reload();await pa.getByRole('heading',{name:'Hi QA Browser A',exact:true}).waitFor();assert.equal((await api(pa,'/api/data')).body.state.workouts.length,1);check('Reload retains routine/weight/workout');
    await signout(pa);await pa.getByRole('button',{name:'Sign in with passkey',exact:true}).click();await pa.getByRole('heading',{name:'Hi QA Browser A',exact:true}).waitFor();assert.equal((await api(pa,'/api/data')).body.state.workouts.length,1);check('UI logout/login WebAuthn retains profile history');

    const b=await browser.newContext({viewport:{width:390,height:844}});const pb=await b.newPage();const vb=await virtual(pb);const userB=await register(pb,'QA Browser B');const emptyB=(await api(pb,'/api/data')).body.state;assert.deepEqual(emptyB?.routines||[],[]);assert.deepEqual(emptyB?.workouts||[],[]);assert.equal((await api(pb,'/api/admin/users')).status,403);check('Second UI passkey profile isolated; admin unauthorized 403');
    const wrongOwner=await api(pb,'/api/data','PUT',{state:saved.state,baseRevision:0,ownerId:userA.id});assert.equal(wrongOwner.status,409);assert.deepEqual((await api(pb,'/api/data')).body.state,emptyB);check('Authenticated cross-owner PUT rejected without contaminating B');
    saved=(await api(pa,'/api/data')).body;const first=await api(pa,'/api/data','PUT',{state:{...saved.state,targetW:69},baseRevision:saved.revision,ownerId:userA.id});assert.equal(first.status,200);const stale=await api(pa,'/api/data','PUT',{state:{...saved.state,targetW:65},baseRevision:saved.revision,ownerId:userA.id});assert.equal(stale.status,409);assert.equal((await api(pa,'/api/data')).body.state.targetW,69);check('Real authenticated CAS stale snapshot returns 409 and preserves latest');
    for(const payload of ['{"state":',JSON.stringify({state:[],baseRevision:0,ownerId:userA.id})])assert.equal((await api(pa,'/api/data','PUT',payload)).status,400);assert.equal((await api(pa,'/api/health')).status,200);check('Malformed JSON/array state HTTP 400; runtime still healthy');

    // Copy only browser-generated test passkey via CDP to model a synced password manager.
    const syncedCred=(await va.cdp.send('WebAuthn.getCredentials',{authenticatorId:va.authenticatorId})).credentials[0];
    const a2=await browser.newContext();const pa2=await a2.newPage();const va2=await virtual(pa2);await va2.cdp.send('WebAuthn.addCredential',{authenticatorId:va2.authenticatorId,credential:syncedCred});await pa2.goto(base);await pa2.getByRole('button',{name:'Sign in with passkey',exact:true}).click();await pa2.getByRole('heading',{name:'Hi QA Browser A',exact:true}).waitFor();assert.equal((await api(pa2,'/api/data')).body.state.targetW,69);check('Second browser context genuine WebAuthn login + server state sync');
    // Third context starts guest-only; no server PUTs are permitted in this flow.
    const guest=await browser.newContext();const pg=await guest.newPage();let guestPuts=0;pg.on('request',r=>{if(r.method()==='PUT'&&new URL(r.url()).pathname==='/api/data')guestPuts++});await pg.goto(base);await pg.getByRole('button',{name:'Continue without account',exact:true}).click();await pg.getByRole('button',{name:'Load starter plan (PPL)',exact:true}).click();await pg.reload();await pg.getByRole('button',{name:'Plan',exact:true}).click();await pg.getByText('Push Day',{exact:true}).first().waitFor();assert.equal(guestPuts,0);assert.equal((await api(pg,'/api/data')).status,401);check('Guest browser-local plan survives reload and sends no private state');

    await stop(apiChild);apiChild=start(process.execPath,['server.js'],path.join(root,'api'),{PORT:'3000',DATA_DIR:data,RP_ID:'localhost',ORIGIN:base,ADMIN_UIDS:userA.id,INVITE_ONLY:'1'});await healthy('http://localhost:3000/api/health');assert.equal((await api(pa,'/api/me')).body.user.admin,true);assert.equal((await api(pa,'/api/admin/users')).status,200);assert.equal((await api(pb,'/api/admin/users')).status,403);assert.equal((await api(pg,'/api/register/options','POST',{name:'QA Invalid invite',code:'INVALID'})).status,403);
    const invite=await api(pa,'/api/admin/invites/new','POST',{});assert.equal(invite.status,200);const code=invite.body.invite.code;assert.equal((await api(pg,'/api/register/options','POST',{name:'QA Invite',code})).status,200);assert.equal((await api(pa,'/api/admin/invites/revoke','POST',{code})).status,200);assert.equal((await api(pg,'/api/register/options','POST',{name:'QA Invite',code})).status,403);check('API restart preserves real sessions/state; owner admin + invite create/revoke/invalid');
    assert.equal((await api(pa,'/api/data')).body.state.workouts.length,1);check('Isolated runtime restart preserves workout and passkey sessions');
    await pa.reload();await pa.getByRole('heading',{name:'Hi QA Browser A',exact:true}).waitFor();await pa.getByRole('button',{name:'Log',exact:true}).click();await pa.getByRole('button',{name:'delete',exact:true}).click();await pa.locator('.mback').last().click({position:{x:3,y:3}});await synced(pa,d=>d.state?.bodyweight?.length===0);check('UI body-weight delete persisted');
    await pa.getByRole('button',{name:'Plan',exact:true}).click();await pa.getByText('QA Browser routine',{exact:true}).last().click();await pa.getByRole('button',{name:'Delete routine',exact:true}).click();await pa.locator('#modal-root').getByRole('button',{name:'Delete',exact:true}).click();await synced(pa,d=>d.state?.routines?.length===0);check('UI routine delete persisted');
    await pa.screenshot({path:path.join(out,'qa-plan-deleted.png'),fullPage:true});
    const mediaFiles=(await import('../frontend/src/lib/exercises-data.js')).EXDB;for(const asset of [mediaFiles[0].img,mediaFiles[0].gif]){const res=await fetch(base+'/'+(asset.endsWith('.gif')?'gif/':'img/')+asset);assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/^image\//);assert.ok((await res.arrayBuffer()).byteLength>100);}check('JPG/GIF actual bytes served through frontend proxy');
    const backup=path.join(os.tmpdir(),'opengym-qa-backup-'+Date.now());fs.cpSync(data,backup,{recursive:true});await stop(apiChild);apiChild=start(process.execPath,['server.js'],path.join(root,'api'),{PORT:'3000',DATA_DIR:backup,RP_ID:'localhost',ORIGIN:base,ADMIN_UIDS:userA.id,INVITE_ONLY:'1'});await healthy('http://localhost:3000/api/health');assert.equal((await api(pa,'/api/data')).body.state.workouts.length,1);check('Private isolated backup/restore retains signed session and data');
  }
  const sourceContext=await browser.newContext();const sourcePage=await sourceContext.newPage();await sourcePage.goto(base);await sourcePage.getByRole('button',{name:'Continue without account',exact:true}).click();await sourcePage.getByRole('button',{name:'Settings',exact:true}).click();assert.equal(await sourcePage.getByRole('link',{name:'source code',exact:true}).getAttribute('href'),'https://github.com/jadercarvalhoPRM/openGym');check('Selfhost Settings footer links corresponding fork source');
  assert.deepEqual(errors,[]);check('Browser page errors', 'none');
} catch(e) { if(browser){const p=browser.contexts()[0]?.pages()[0];if(p){fs.writeFileSync(path.join(out,'qa-failure-page.txt'),await p.locator('body').innerText());await p.screenshot({path:path.join(out,'qa-failure.png'),fullPage:true});}}checks.push({name:'E2E runner',status:'FAIL',details:e.stack});log('FAIL '+e.stack);process.exitCode=1; }
finally {
  if(browser)await browser.close();if(media)await new Promise(r=>media.close(r));
  for(const p of children.reverse()){if(p.exitCode===null){p.kill();await Promise.race([new Promise(r=>p.once('exit',r)),new Promise(r=>setTimeout(r,2000))]);}}
  fs.writeFileSync(path.join(out,'browser-qa.json'),JSON.stringify({at:new Date().toISOString(),origin:base,authentication:'CDP virtual authenticator; no physical biometrics',checks},null,2));
  fs.writeFileSync(path.join(out,'browser-qa.log'),events.join('\n'));
  // Isolated runtime retained privately outside the checkout for rerun/diagnostics. No keys printed.
}
