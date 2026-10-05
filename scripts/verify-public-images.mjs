import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

const images = process.argv.slice(2)
assert.equal(images.length, 2, 'Provide API and web digest references')
for (const image of images) {
  const match = /^ghcr\.io\/(jadercarvalhoprm\/opengym-(api|web))@(sha256:[a-f0-9]{64})$/.exec(image)
  assert.ok(match, 'Unexpected image namespace or non-digest reference')
  const [, name, , digest] = match
  const tokenUrl = new URL('https://ghcr.io/token')
  tokenUrl.searchParams.set('service', 'ghcr.io')
  tokenUrl.searchParams.set('scope', `repository:${name}:pull`)
  const tokenResponse = await fetch(tokenUrl, { signal: AbortSignal.timeout(30000) })
  assert.equal(tokenResponse.status, 200, `Anonymous read permission missing for ${name}`)
  const { token } = await tokenResponse.json()
  assert.equal(typeof token, 'string')
  const manifest = await fetch(`https://ghcr.io/v2/${name}/manifests/${digest}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.oci.image.manifest.v1+json,application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.v2+json,application/vnd.docker.distribution.manifest.list.v2+json',
    },
    signal: AbortSignal.timeout(30000),
  })
  assert.equal(manifest.status, 200, `Anonymous pull manifest failed for ${name}`)
  assert.equal(manifest.headers.get('docker-content-digest'), digest)
  const bytes = Buffer.from(await manifest.arrayBuffer())
  assert.equal(`sha256:${createHash('sha256').update(bytes).digest('hex')}`, digest)
  console.log(`Public manifest verification PASS: ${image}`)
}
