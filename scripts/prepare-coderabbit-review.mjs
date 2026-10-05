import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { tmpdir } from 'node:os'

// Export selected source bytes into a new Git history. Never copy upstream Git
// objects: even a deletion diff could otherwise disclose old runtime secrets.
const repo = resolve(import.meta.dirname, '..')
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
const base = git('rev-parse', 'HEAD').toString().trim()
const permitted = (path) => !/^(?:data|media|backups|node_modules|reports|\.git|frontend\/(?:node_modules|dist)|api\/node_modules)(?:\/|$)/i.test(path)
  && !/(?:^|\/)\.env(?:$|\.(?!example$))/i.test(path)
  && !/\.(?:pem|key|p12|pfx|jks|keystore|exe|dll|zip|tar|gz|jpg|jpeg|gif|png|webp|ico|mp4|woff2?)$/i.test(path)
const paths = (bytes) => bytes.toString('utf8').split('\0').filter(Boolean)
const baseline = paths(git('ls-tree', '-rz', '--name-only', base)).filter(permitted)
const current = [...new Set(paths(git('ls-files', '-z', '--cached', '--others', '--exclude-standard')))].filter(permitted)
const work = mkdtempSync(join(tmpdir(), 'opengym-coderabbit-'))
const hashes = []
const write = (path, bytes) => {
  const target = resolve(work, path)
  if (!target.startsWith(work + '\\') && !target.startsWith(work + '/')) throw Error('Unsafe review path')
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, bytes)
}
for (const path of baseline) write(path, git('show', `${base}:${path}`))
const local = (...args) => execFileSync('git', ['-C', work, ...args], { maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()
local('init', '--initial-branch=review-baseline')
local('add', '--all')
local('-c', 'user.name=openGym review', '-c', 'user.email=review@localhost.invalid', 'commit', '-m', `Sanitized public source baseline ${base}`)
local('remote', 'add', 'origin', 'https://github.com/jadercarvalhoPRM/openGym.git')
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['aws-key', /\bAKIA[A-Z0-9]{16}\b/],
  ['cloudflare-api-token', /(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN)\s*[:=]\s*["']?[A-Za-z0-9_-]{30,}/],
]
const findings = []
for (const path of current) {
  const source = join(repo, path)
  if (!existsSync(source)) continue
  const bytes = readFileSync(source)
  for (const [reason, pattern] of patterns) if (pattern.test(bytes.toString('utf8'))) findings.push({ path, reason })
  write(path, bytes)
  hashes.push({ path, sha256: createHash('sha256').update(bytes).digest('hex') })
}
if (findings.length) throw Error(`Secret scan failed: ${JSON.stringify(findings)}`)
// Stage only this disposable copy, keeping Git's normal CRLF conversion and
// ensuring unchanged Windows source timestamps do not inflate the review scope.
local('add', '--all')
const inputDigest = createHash('sha256').update(JSON.stringify(hashes)).digest('hex')
const metadata = { originalBase: base, sanitizedBase: local('rev-parse', 'HEAD'), workspace: work, inputDigest, sourceFiles: hashes.length, findings: [], files: hashes }
const evidence = join(repo, 'reports', 'coderabbit-input.json')
mkdirSync(dirname(evidence), { recursive: true })
writeFileSync(evidence, JSON.stringify(metadata, null, 2) + '\n')
console.log(JSON.stringify({ workspace: work, sourceFiles: hashes.length, secretFindings: 0, inputDigest, evidence }))
