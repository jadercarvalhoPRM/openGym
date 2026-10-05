import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
// Compose deliberately re-escapes dollars in its reusable JSON output. This
// serialization is not the label ultimately stored in the Swarm service.
assert.equal(resolved.services.web.deploy.labels['traefik.http.middlewares.opengym-bootstrap.basicauth.users'], sample.replaceAll('$', () => '$$'))
assert.equal(resolved.services.web.deploy.labels['traefik.http.routers.opengym.middlewares'], 'opengym-bootstrap')
assert.equal(resolved.services.api.environment.RP_ID, 'comespecialista.online')
assert.equal(resolved.services.api.environment.ORIGIN, 'https://comespecialista.online')
assert.equal(resolved.services.api.deploy.replicas, 1)
assert.equal(resolved.services.api.deploy.update_config.order, 'stop-first')
assert.ok(!resolved.services.api.ports?.length)
execFileSync('docker', ['stack', 'config', '-c', 'deploy/stack.yml'], { env, stdio: 'ignore' })
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Runtime label proof runs only on the disposable GitHub runner')
const docker = (...args) => execFileSync('docker', args, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
assert.equal(docker('info', '--format', '{{.Swarm.LocalNodeState}}'), 'inactive', 'Do not alter an existing Swarm')
const override = join(mkdtempSync(join(tmpdir(), 'opengym-label-proof-')), 'override.yml')
writeFileSync(override, "version: '3.8'\nservices:\n  api:\n    deploy:\n      replicas: 0\n  web:\n    deploy:\n      replicas: 0\nnetworks:\n  matriz:\n    external: true\n    name: opengym-ci-label-matriz\n")
docker('swarm', 'init', '--advertise-addr', '127.0.0.1')
try {
  docker('network', 'create', '--driver', 'overlay', 'opengym-ci-label-matriz')
  // Zero tasks, no pulls and no public ports; this tests the actual production
  // template and environment substitution without starting application data.
  docker('stack', 'deploy', '--resolve-image', 'never', '-c', 'deploy/stack.yml', '-c', override, 'opengym-ci-label-proof')
  const actual = JSON.parse(docker('service', 'inspect', 'opengym-ci-label-proof_web'))[0]
  assert.equal(actual.Spec.Labels['traefik.http.middlewares.opengym-bootstrap.basicauth.users'], sample)
  assert.equal(actual.Spec.Mode.Replicated.Replicas, 0)
  console.log('Stack config and real Swarm label PASS: raw bcrypt value reaches service unchanged; protected bootstrap, RP/origin and single-writer isolation.')
} finally {
  docker('swarm', 'leave', '--force')
}
