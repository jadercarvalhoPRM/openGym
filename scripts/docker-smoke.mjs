import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { EXDB } from '../frontend/src/lib/exercises-data.js'

const base = process.env.SMOKE_ORIGIN || 'http://localhost:8080'
const project = process.env.COMPOSE_PROJECT_NAME || 'opengym-ci'
const docker = (...args) => execFileSync('docker', ['compose', '-p', project, ...args], { encoding: 'utf8' })
const request = async (path, expected, options) => {
  const response = await fetch(`${base}${path}`, options)
  assert.equal(response.status, expected, `${path}: expected ${expected}, got ${response.status}`)
  return response
}

const health = await request('/api/health', 200)
assert.deepEqual(await health.json(), { ok: true, users: 0 })
assert.equal(health.headers.get('x-content-type-options'), 'nosniff')
const shell = await request('/', 200)
assert.match(await shell.text(), /<div id="root"><\/div>/)
for (const path of ['/manifest.json', '/sw.js', '/api/config']) await request(path, 200)
for (const path of ['/api/me', '/api/data', '/api/admin/users']) await request(path, 401)
await request('/api/register/options', 400, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: '{'
})
await request('/api/register/options', 413, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(5 * 1024 * 1024 + 1)
})
for (const exercise of [EXDB[0], EXDB.at(-1)]) {
  for (const kind of ['img', 'gif']) {
    const response = await request(`/${kind}/${exercise[kind]}`, 200)
    assert.match(response.headers.get('content-type'), /^image\//)
    assert.ok((await response.arrayBuffer()).byteLength > 100)
  }
}
const mediaCheck = docker('exec', '-T', 'web', 'sh', '-c', 'cd /usr/share/nginx/html && sha256sum -c media-manifest.sha256 >/dev/null')
assert.equal(mediaCheck.trim(), '')
const privateState = () => JSON.parse(docker('exec', '-T', 'api', 'node', '-e',
  "const fs=require('fs'),c=require('crypto'); const names=['secret','vapid.json']; console.log(JSON.stringify({keys:names.map(n=>c.createHash('sha256').update(fs.readFileSync('/data/'+n)).digest('hex')),users:fs.existsSync('/data/db.json')?JSON.parse(fs.readFileSync('/data/db.json')).users.length:0}))"))
const before = privateState()
assert.equal(before.users, 0)
docker('restart', 'api')
let ready = false
for (let attempt = 0; attempt < 30; attempt++) {
  try { ready = (await fetch(`${base}/api/health`)).ok } catch { /* restart in progress */ }
  if (ready) break
  await new Promise(resolve => setTimeout(resolve, 1000))
}
assert.ok(ready, 'API did not become healthy after restart')
assert.deepEqual(privateState(), before, 'Fresh secret/VAPID were not preserved across restart')
const burst = await Promise.all(Array.from({ length: 45 }, () => fetch(`${base}/api/login/options`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
})))
assert.ok(burst.some(response => response.status === 429), 'Auth rate limit did not enforce 429')
console.log('Docker smoke PASS: fresh zero-user volume, proxy, auth denial, validation, body limit, all media checksums, PWA shell, key persistence and rate limiting.')
