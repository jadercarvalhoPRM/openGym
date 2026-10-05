import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'

vi.mock('../lib/mobile.js', () => ({ MOBILE: false, nativeLoad: vi.fn(), nativeSave: vi.fn(), syncReminder: vi.fn() }))
vi.mock('../lib/exercises.js', () => ({ registerCustom: vi.fn() }))
let useStore
const accountA = { id: 'regression-A', name: 'QA A' }
const accountB = { id: 'regression-B', name: 'QA B' }
// Captured local reproduction: existing cached A snapshot + expired /api/me response.
const snapshotA = { routines: [{ id: 'qa-A', name: 'QA A routine', ex: [] }], bodyweight: [{ d: '2026-10-05', w: 81 }], workouts: [], _ts: 1234 }
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  const storage = new Map()
  vi.stubGlobal('localStorage', { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)), removeItem: k => storage.delete(k) })
  vi.stubGlobal('document', { addEventListener: vi.fn(), visibilityState: 'visible' })
  vi.stubGlobal('window', { addEventListener: vi.fn() })
  vi.stubGlobal('navigator', { userAgent: 'QA', language: 'en' })
  localStorage.setItem('gym_user', JSON.stringify(accountA))
  localStorage.setItem('gym_state_v1', JSON.stringify(snapshotA))
  localStorage.setItem('gym_dirty', '1')
  ;({ useStore } = await import('./useStore.js'))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('profile ownership', () => {
  it('401 clears visible A data and preserves its offline copy separately', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ error: 'not signed in' }, 401)))
    await useStore.getState().boot()
    expect(useStore.getState().user).toBeNull()
    expect(useStore.getState().S.routines).toEqual([])
    expect(JSON.parse(localStorage.getItem('gym_profile_regression-A')).state.routines).toEqual(snapshotA.routines)
  })
  it('switch A to empty B never uploads A or runs its pending timer', async () => {
    const fetch = vi.fn(async () => response({ state: null, revision: 0 }))
    vi.stubGlobal('fetch', fetch)
    useStore.getState().update(s => { s.targetW = 75 })
    useStore.getState().setUser(accountB)
    await useStore.getState().pullState()
    await vi.advanceTimersByTimeAsync(1600)
    expect(useStore.getState().S.routines).toEqual([])
    expect(fetch.mock.calls.filter(([, o]) => o?.method === 'PUT')).toHaveLength(0)
  })
  it('guest migration is explicit only when creating a new profile', () => {
    useStore.getState().setUser(null)
    useStore.getState().setGuest(true)
    useStore.getState().replaceState(snapshotA)
    useStore.getState().setUser(accountB, { migrateGuest: true })
    expect(useStore.getState().S.routines).toEqual(snapshotA.routines)
  })
  it('pull preserves server timestamp and clean unchanged state is never pushed', async () => {
    useStore.getState().setUser(accountB)
    const fetch = vi.fn(async () => response({ state: { ...snapshotA, routines: [], _ts: 77 }, revision: 4 }))
    vi.stubGlobal('fetch', fetch)
    await useStore.getState().pullState()
    expect(useStore.getState().S._ts).toBe(77)
    await useStore.getState().pushState()
    expect(fetch.mock.calls.filter(([, o]) => o?.method === 'PUT')).toHaveLength(0)
  })
  it('inflight A GET result never lands in B', async () => {
    let resolve
    vi.stubGlobal('fetch', vi.fn(() => new Promise(r => { resolve = r })))
    const pending = useStore.getState().pullState()
    useStore.getState().setUser(accountB)
    resolve(response({ state: snapshotA, revision: 1 }))
    await pending
    expect(useStore.getState().user.id).toBe(accountB.id)
    expect(useStore.getState().S.routines).toEqual([])
  })
  it('slow PUT preserves and automatically sends mutations made during upload', async () => {
    useStore.getState().setUser(accountB)
    let resolve
    const fetch = vi.fn(async (path, opts) => {
      if (!opts) return response({ state: null, revision: 0 })
      if (fetch.mock.calls.filter(([,o]) => o?.method === 'PUT').length === 1) return new Promise(r => { resolve = r })
      return response({ ok: true, revision: 2 })
    })
    vi.stubGlobal('fetch', fetch)
    await useStore.getState().pullState()
    useStore.getState().update(s => { s.targetW = 75 })
    const upload = useStore.getState().pushState()
    useStore.getState().update(s => { s.targetW = 73 })
    await vi.advanceTimersByTimeAsync(1600)
    resolve(response({ ok: true, revision: 1 }))
    await upload
    await vi.advanceTimersByTimeAsync(1600)
    const requests = fetch.mock.calls.filter(([,o]) => o?.method === 'PUT')
    expect(requests).toHaveLength(2)
    expect(JSON.parse(requests[1][1].body)).toMatchObject({ baseRevision: 1, ownerId: accountB.id, state: { targetW: 73 } })
    expect(localStorage.getItem('gym_dirty')).toBeNull()
  })
  it('conflict keeps pending local state and failed restore never destroys it', async () => {
    useStore.getState().setUser(accountB)
    vi.stubGlobal('fetch', vi.fn(async () => response({ state: null, revision: 0 })))
    await useStore.getState().pullState()
    useStore.getState().update(s => { s.targetW = 73 })
    vi.stubGlobal('fetch', vi.fn(async () => response({ error: 'state changed on another device', revision: 1 }, 409)))
    await useStore.getState().pushState()
    expect(useStore.getState().syncError).toBe('conflict')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await useStore.getState().restoreServerState()
    expect(useStore.getState().S.targetW).toBe(73)
    expect(JSON.parse(localStorage.getItem('gym_profile_regression-B')).dirty).toBe(true)
  })
})
