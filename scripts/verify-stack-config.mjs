import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

// Public synthetic value, deliberately containing bcrypt dollar separators.
// Never render a real production hash into CI logs/artifacts.
const sample = `ci:${'$'}2a${'$'}12${'$'}${'x'.repeat(53)}`
const env = {
  ...process.env,
  OPENGYM_API_IMAGE: 'opengym-api:local',
  OPENGYM_WEB_IMAGE: 'opengym-web:local',
  OPENGYM_BOOTSTRAP_AUTH: sample,
}
const resolved = JSON.parse(execFileSync('docker', ['compose', '-f', 'deploy/stack.yml', 'config', '--format', 'json'], {
  env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}))
assert.equal(resolved.services.web.deploy.labels['traefik.http.middlewares.opengym-bootstrap.basicauth.users'], sample)
assert.equal(resolved.services.web.deploy.labels['traefik.http.routers.opengym.middlewares'], 'opengym-bootstrap')
assert.equal(resolved.services.api.environment.RP_ID, 'comespecialista.online')
assert.equal(resolved.services.api.environment.ORIGIN, 'https://comespecialista.online')
assert.equal(resolved.services.api.deploy.replicas, 1)
assert.equal(resolved.services.api.deploy.update_config.order, 'stop-first')
assert.ok(!resolved.services.api.ports?.length)
execFileSync('docker', ['stack', 'config', '-c', 'deploy/stack.yml'], { env, stdio: 'ignore' })
console.log('Stack config PASS: raw env bcrypt separators preserved, protected bootstrap, RP/origin and single-writer API isolation.')
