import { access, readdir } from 'node:fs/promises'
import { EXDB } from '../frontend/src/lib/exercises-data.js'

if (EXDB.length !== 1324) throw new Error(`Unexpected exercise count: ${EXDB.length}`)
for (const [kind, extension] of [['img', '.jpg'], ['gif', '.gif']]) {
  const names = new Set(EXDB.map(exercise => exercise[kind]))
  if (names.size !== EXDB.length) throw new Error(`Duplicate ${kind} reference`)
  const files = await readdir(new URL(`../media/${kind}/`, import.meta.url))
  if (files.filter(name => name.endsWith(extension)).length !== names.size) {
    throw new Error(`Unexpected ${kind} count`)
  }
  for (const name of names) {
    if (!name || name.includes('/') || name.includes('..') || !name.endsWith(extension)) {
      throw new Error(`Invalid ${kind} media filename`)
    }
    await access(new URL(`../media/${kind}/${name}`, import.meta.url))
  }
}
console.log('Media audit PASS: every exercise has a local JPG and GIF (1324 + 1324).')
