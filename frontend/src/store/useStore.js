import { create } from 'zustand'
import { api } from '../lib/api.js'
import { localTZ } from '../lib/format.js'
import { registerCustom } from '../lib/exercises.js'
import { DEMO, DEMO_SEEDED } from '../lib/demo.js'
import { MOBILE, nativeLoad, nativeSave, syncReminder } from '../lib/mobile.js'

const KEY = 'gym_state_v1'
export const DEF = {
  unit: 'kg', restSec: 90, sound: true, keepAwake: true, lang: 'en',
  theme: 'dark', accent: 'lime', body: 'male', targetW: null,
  bodyweight: [], routines: [], week: {}, dayPlan: {},
  exWeights: {}, workouts: [], active: null, customEx: [], gifSize: 'full',
  // effort: which per-set effort scale is logged — 'none' | 'rir' | 'rpe'. null, not 'none', so
  // that a profile which never chose (loaded state is overlaid on DEF, on every path: local,
  // server pull, backup import) still falls back to the `showRir` boolean this replaced and
  // keeps the column it had. See effortOf.
  reminder: { on: false, time: '08:00', tz: null }, effort: null
}
const clone = o => JSON.parse(JSON.stringify(o))

function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return Object.assign(clone(DEF), JSON.parse(raw))
  } catch (e) { /* ignore */ }
  return clone(DEF)
}

const hasData = st => !!((st.workouts || []).length || (st.routines || []).length || (st.bodyweight || []).length)

export const useStore = create((set, get) => {
  let pushTm = null
  let saveTm = null
  let epoch = 0
  let syncing = false
  let owner = (() => { try { return JSON.parse(localStorage.getItem('gym_user'))?.id || 'guest' } catch { return 'guest' } })()
  const cacheKey = id => `gym_profile_${id}`
  let cached
  try { cached = JSON.parse(localStorage.getItem(cacheKey(owner))) } catch { /* legacy cache */ }
  let dirty = cached?.dirty ?? localStorage.getItem('gym_dirty') === '1'
  let revision = cached?.revision ?? null
  const cache = S => {
    localStorage.setItem(cacheKey(owner), JSON.stringify({ state: S, dirty, revision }))
    localStorage.setItem(KEY, JSON.stringify(S))
    if (dirty) localStorage.setItem('gym_dirty', '1'); else localStorage.removeItem('gym_dirty')
  }
  const current = (id, started) => owner === id && epoch === started

  // Mobile build: mirror the state into a file in the app's data directory (survives WebView
  // storage eviction) and keep the native reminder schedule in step with the weekly plan.
  const nativePersist = () => {
    clearTimeout(saveTm)
    saveTm = setTimeout(() => { saveTm = null; nativeSave(get().S); syncReminder(get().S) }, 800)
  }

  const persist = (S, push = true, changed = true) => {
    if (changed) { S._ts = Date.now(); dirty = true }
    registerCustom(S.customEx)
    cache(S)
    set({ S })
    if (MOBILE) nativePersist()
    if (push && get().user) {
      clearTimeout(pushTm)
      const id = owner, started = epoch
      pushTm = setTimeout(() => { pushTm = null; if (current(id, started)) get().pushState() }, 1500)
    }
  }

  // A setting changed right before switching away/closing the tab must not get lost mid-debounce
  // (e.g. setting the reminder time then immediately backgrounding to test it). On mobile the
  // same applies to the file mirror — backgrounding is often the last thing before the OS
  // kills the app.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { if (get().user) get().pullState(); return }
    if (document.visibilityState !== 'hidden') return
    if (MOBILE && saveTm) {
      clearTimeout(saveTm)
      saveTm = null
      nativeSave(get().S)
    }
    if (pushTm) {
      clearTimeout(pushTm)
      pushTm = null
      get().pushState()
    }
  })

  // Everything a sign-out leaves behind on this device, whichever way it was triggered.
  const clearLocalSession = () => {
    get().setUser(null)
    localStorage.removeItem('gym_guest')
  }
  window.addEventListener('online', () => { if (get().user) get().pullState() })

  return {
    S: (() => { const s = cached?.state ? Object.assign(clone(DEF), cached.state) : loadState(); registerCustom(s.customEx); return s })(),
    user: (() => { try { return JSON.parse(localStorage.getItem('gym_user')) || null } catch { return null } })(),
    ready: false,
    syncError: null,

    // Mutate a draft of S via producer fn, then persist + schedule sync.
    update(mut, push = true) {
      const S = clone(get().S)
      mut(S)
      persist(S, push)
    },
    replaceState(S, push = false) { persist(clone(S), push) },

    isGuest: () => localStorage.getItem('gym_guest') === '1',
    setGuest(v) { if (v) localStorage.setItem('gym_guest', '1'); else localStorage.removeItem('gym_guest'); set({}) },

    setUser(u, { migrateGuest = false } = {}) {
      const nextOwner = u?.id || 'guest'
      if (nextOwner !== owner) {
        const guest = owner === 'guest' && migrateGuest ? clone(get().S) : null
        cache(get().S) // preserves the only offline copy under its actual owner
        clearTimeout(pushTm); pushTm = null
        clearTimeout(saveTm); saveTm = null
        epoch++; syncing = false; owner = nextOwner
        let saved
        try { saved = JSON.parse(localStorage.getItem(cacheKey(owner))) } catch { /* empty profile */ }
        dirty = guest ? true : !!saved?.dirty
        revision = guest ? 0 : saved?.revision ?? null
        const S = Object.assign(clone(DEF), guest || saved?.state || {})
        registerCustom(S.customEx); cache(S)
        set({ S, syncError: null })
      }
      if (u) { localStorage.setItem('gym_user', JSON.stringify(u)); localStorage.removeItem('gym_guest') }
      else localStorage.removeItem('gym_user')
      set({ user: u })
    },

    async pushState() {
      if (!get().user || !dirty || syncing) return
      clearTimeout(pushTm); pushTm = null
      const id = owner, started = epoch
      if (revision === null) { await get().pullState(); return }
      const S = get().S
      syncing = true
      try {
        const result = await api('/api/data', { method: 'PUT', body: JSON.stringify({ state: S, baseRevision: revision, ownerId: id }) })
        if (!current(id, started)) return
        revision = result.revision
        if (get().S === S) dirty = false
        cache(get().S); set({ syncError: null })
      } catch (e) {
        if (!current(id, started)) return
        cache(get().S)
        set({ syncError: e.status === 409 ? 'conflict' : 'offline' })
        if (e.status === 401) get().setUser(null)
      } finally {
        if (current(id, started)) {
          syncing = false
          if (dirty && get().S !== S && !get().syncError) {
            clearTimeout(pushTm)
            pushTm = setTimeout(() => { pushTm = null; if (current(id, started)) get().pushState() }, 1500)
          }
        }
      }
    },
    // Called only after the user has explicitly chosen to discard the pending local copy.
    async restoreServerState() {
      if (!get().user || syncing) return
      const id = owner, started = epoch
      try {
        const { state, revision: serverRevision } = await api('/api/data')
        if (!current(id, started)) return
        dirty = false; revision = serverRevision
        persist(Object.assign(clone(DEF), state || {}), false, false)
        set({ syncError: null })
      } catch (e) { if (current(id, started)) { set({ syncError: 'offline' }); if (e.status === 401) get().setUser(null) } }
    },
    async pullState() {
      if (!get().user || syncing) return
      const id = owner, started = epoch
      try {
        const { state, revision: serverRevision } = await api('/api/data')
        if (!current(id, started)) return
        if (revision !== null && serverRevision < revision) return
        const S = get().S
        if (dirty) {
          // Unknown legacy revision can only be uploaded to an empty profile safely.
          if ((revision === null && !state) || revision === serverRevision) {
            revision = serverRevision; await get().pushState()
          } else { cache(S); set({ syncError: 'conflict' }) }
        } else {
          revision = serverRevision
          const active = S.active
          const next = Object.assign(clone(DEF), state || {})
          if (active) next.active = active
          persist(next, false, false); set({ syncError: null })
        }
      } catch (e) {
        if (!current(id, started)) return
        if (e.status === 401) get().setUser(null)
        else set({ syncError: 'offline' })
      }
    },

    async signOut() {
      const id = owner, started = epoch
      try {
        await get().pushState()
        if (!current(id, started)) return
        await api('/api/logout', { method: 'POST', body: '{}' })
      } catch (e) { /* preserve offline cache */ }
      if (current(id, started)) clearLocalSession()
    },

    // "Sign out everywhere": the server bumps this profile's session version, which kills every
    // session it has on any device — this browser included, so the app has to end up exactly
    // where a normal signOut leaves it. Unlike signOut the request is NOT swallowed: if it fails
    // the sessions elsewhere are all still valid, and wiping this device's copy of the data
    // would sign the user out of the one place the bump didn't reach. Caller reports the error.
    async signOutAll() {
      const id = owner, started = epoch
      await get().pushState()   // never throws — stores gym_dirty and moves on when offline
      if (!current(id, started)) return
      await api('/api/logout/all', { method: 'POST', body: '{}' })
      if (current(id, started)) clearLocalSession()
    },

    // Demo build only: drop the seeded example profile back in (Settings → "Reset demo data").
    // Dynamic import so the generator never ships in a self-hosted bundle.
    async resetDemo() {
      const { buildDemoState } = await import('../lib/demoSeed.js')
      localStorage.removeItem('gym_dirty')
      persist(Object.assign(clone(DEF), buildDemoState()), false)
    },

    // Boot: ask the server who we are, then pull.
    async boot() {
      // Mobile build: no backend either — restore from the file mirror (the durable copy;
      // localStorage may have been evicted since the last run) and go straight in.
      if (MOBILE) {
        const saved = await nativeLoad()
        const S = get().S
        if (saved && (!hasData(S) || (saved._ts || 0) >= (S._ts || 0))) {
          persist(Object.assign(clone(DEF), saved), false)
        } else if (hasData(S)) {
          nativeSave(S)   // first run after an update from a file-less version: seed the mirror
        }
        get().setGuest(true)
        syncReminder(get().S)
        set({ ready: true })
        return
      }
      // Demo build (GitHub Pages): no backend at all — seed once, stay in guest mode.
      if (DEMO) {
        if (!localStorage.getItem(DEMO_SEEDED)) {
          localStorage.setItem(DEMO_SEEDED, '1')
          await get().resetDemo()
        }
        get().setGuest(true)
        set({ ready: true })
        return
      }
      try {
        const me = await api('/api/me')
        get().setUser(me.user)
        await get().pullState()
        // Re-stamp the reminder's timezone on every load — keeps it correct if you're travelling,
        // without needing to revisit Settings.
        const tz = localTZ()
        if (get().S.reminder?.on && get().S.reminder.tz !== tz) {
          get().update(s => { s.reminder = { ...s.reminder, tz } })
        }
      } catch (e) {
        if (e.status === 401) get().setUser(null)
      }
      set({ ready: true })
    }
  }
})

export { hasData }
