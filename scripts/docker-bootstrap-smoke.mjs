import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { EXDB } from '../frontend/src/lib/exercises-data.js'

assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Run only on the disposable CI runner')
const project = process.env.COMPOSE_PROJECT_NAME || 'opengym-ci'
const name = `${project}-bootstrap`
const openName = `${project}-open`
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const api = docker('compose', '-p', project, 'ps', '-q', 'api')
const networks = JSON.parse(docker('inspect', api))[0].NetworkSettings.Networks
const network = Object.keys(networks).find(n => n === `${project}_private`)
assert.ok(network, 'Own isolated compose network missing')
const password = randomBytes(32).toString('base64url')
const verifier = `opengym-preview:{SHA}${createHash('sha1').update(password).digest('base64')}`
const authorization = `Basic ${Buffer.from(`opengym-preview:${password}`).toString('base64')}`
const rejected = spawnSync('docker', ['run', '--rm', '--network', network,
  '-e', 'OPENGYM_BOOTSTRAP_REQUIRED=1', 'opengym-web:local'], { encoding: 'utf8', timeout: 15000 })
assert.ok(rejected.status !== null && rejected.status !== 0, 'Missing verifier did not fail closed before listen')
const injected = spawnSync('docker', ['run', '--rm', '--network', network,
  '-e', 'OPENGYM_API_UPSTREAM=api;return 200;', 'opengym-web:local'], { encoding: 'utf8', timeout: 15000 })
assert.ok(injected.status !== null && injected.status !== 0, 'Invalid upstream did not fail closed before listen')
const base = 'http://127.0.0.1:8081'
const request = async (path, expected, auth = false) => {
  const response = await fetch(`${base}${path}`, auth ? { headers: { authorization } } : {})
  assert.equal(response.status, expected, `${path}: got ${response.status}, expected ${expected}`)
  return response
}
try {
  // Final owner setup must be able to remove bootstrap on a fresh task. Removing
  // REQUIRED alone is insufficient: an explicitly retained AUTH remains protective.
  docker('run', '-d', '--name', openName, '--network', network, '-p', '127.0.0.1:8082:80',
    '-e', 'OPENGYM_BOOTSTRAP_REQUIRED=0', '-e', 'OPENGYM_API_UPSTREAM=opengym_api', 'opengym-web:local')
  let opened
  for (let i = 0; i < 30; i++) {
    try { opened = await fetch('http://127.0.0.1:8082/api/health') } catch { /* startup */ }
    if (opened?.status === 200) break
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  assert.equal(opened?.status, 200, 'REQUIRED=0 with AUTH absent must open a new task after owner setup')
  assert.equal(opened.headers.get('www-authenticate'), null)
  docker('rm', '-f', openName)
  // Synthetic verifier is kept in child-process memory, never printed or exported.
  docker('run', '-d', '--name', name, '--network', network, '-p', '127.0.0.1:8081:80',
    '-e', 'OPENGYM_BOOTSTRAP_REQUIRED=1', '-e', `OPENGYM_BOOTSTRAP_AUTH=${verifier}`,
    '-e', 'OPENGYM_API_UPSTREAM=opengym_api', 'opengym-web:local')
  let ready = false
  for (let i = 0; i < 30; i++) {
    try { ready = (await fetch(base)).status === 401 } catch { /* startup */ }
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  assert.ok(ready, 'Protected image never became ready')
  for (const path of ['/', '/api/health', '/api/config', '/api/register/options', '/api/me',
    '/manifest.json', '/sw.js', `/img/${EXDB[0].img}`, `/gif/${EXDB[0].gif}`]) {
    const response = await request(path, 401)
    assert.match(response.headers.get('www-authenticate'), /^Basic realm="openGym preview"$/)
  }
  assert.deepEqual(await (await request('/api/health', 200, true)).json(), { ok: true, users: 0 })
  await request('/', 200, true)
  await request('/api/config', 200, true)
  for (const path of ['/api/me', '/api/data', '/api/admin/users']) await request(path, 401, true)
  for (const exercise of [EXDB[0], EXDB.at(-1)]) {
    for (const kind of ['img', 'gif']) {
      assert.ok((await (await request(`/${kind}/${exercise[kind]}`, 200, true)).arrayBuffer()).byteLength > 100)
    }
  }
  assert.equal(docker('exec', name, 'stat', '-c', '%U:%G:%a', '/etc/nginx/bootstrap.htpasswd'), 'root:nginx:640')
  const logged = spawnSync('docker', ['logs', name], { encoding: 'utf8' })
  assert.equal(logged.status, 0)
  const startupLog = logged.stdout + logged.stderr
  assert.equal((startupLog.match(/syntax is ok/g) || []).length, 2, 'Both preparation passes must validate Nginx')
  docker('restart', name)
  ready = false
  for (let i = 0; i < 30; i++) {
    try { ready = (await fetch(base)).status === 401 } catch { /* restart */ }
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  assert.ok(ready, 'Same-container restart must preserve idempotent protection')
  await request('/api/health', 200, true)
  await request('/api/register/options', 401)
  const result = { pass: true, missingVerifierFailsClosed: true, invalidUpstreamFailsClosed: true,
    explicitUnprotectedTask: true, defaultUnprotectedMode: 'verified by docker-smoke', protectedRoutes: 9,
    authenticatedHealth: true, freshUsers: 0, authFilePermissions: 'root:nginx:640',
    nginxPreparationPasses: 2, sameContainerRestart: true, endpointOverride: 'opengym_api', media: true }
  mkdirSync('reports/ci', { recursive: true })
  writeFileSync('reports/ci/bootstrap-smoke.json', JSON.stringify(result, null, 2))
  console.log('Docker bootstrap PASS: fail-closed verifier, all-route Basic401/200, proxy/media, 640 auth file, two Nginx preparations and same-container restart.')
} finally {
  spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' })
  spawnSync('docker', ['rm', '-f', openName], { encoding: 'utf8' })
}
