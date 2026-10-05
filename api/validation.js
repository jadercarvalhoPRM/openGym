/** @param {unknown} v @returns {v is Record<string, any>} */
const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
/** @param {unknown} state @returns {boolean} */
export function validState(state) {
  if (!object(state)) return false;
  for (const field of ['routines','workouts','bodyweight','customEx']) {
    if (state[field] !== undefined && (!Array.isArray(state[field]) || !state[field].every(object))) return false;
  }
  for (const field of ['week','dayPlan','exWeights','reminder']) if (state[field] !== undefined && !object(state[field])) return false;
  if (state._ts !== undefined && (!Number.isSafeInteger(state._ts) || state._ts < 0)) return false;
  if (state._revision !== undefined && (!Number.isSafeInteger(state._revision) || state._revision < 0)) return false;
  if (state.routines?.some(/** @param {Record<string, any>} r */ r =>
    typeof r.id !== 'string' || typeof r.name !== 'string' || !Array.isArray(r.ex) ||
    !r.ex.every(/** @param {unknown} e */ e => object(e) && typeof e.id === 'string'))) return false;
  if (state.workouts?.some(/** @param {Record<string, any>} w */ w =>
    typeof w.id !== 'string' || typeof w.d !== 'string' || !Array.isArray(w.entries) ||
    !w.entries.every(/** @param {unknown} e */ e => object(e) && typeof e.id === 'string' && Array.isArray(e.sets) && e.sets.every(object)))) return false;
  if (state.bodyweight?.some(/** @param {Record<string, any>} b */ b => typeof b.d !== 'string' || typeof b.w !== 'number' || !Number.isFinite(b.w))) return false;
  if (state.customEx?.some(/** @param {Record<string, any>} e */ e => typeof e.id !== 'string' || typeof e.n !== 'string' || typeof e.bp !== 'string')) return false;
  if (state.reminder?.tz !== undefined && state.reminder.tz !== null && typeof state.reminder.tz !== 'string') return false;
  return true;
}
// Exact browser push providers only. No IPs, arbitrary hosts, custom ports or redirects to
// private networks; the transport sends directly to these HTTPS provider endpoints.
/** @param {unknown} endpoint @returns {boolean} */
export function validPushEndpoint(endpoint) {
  if (typeof endpoint !== 'string') return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && (
      u.hostname === 'fcm.googleapis.com' ||
      u.hostname === 'updates.push.services.mozilla.com' ||
      u.hostname === 'web.push.apple.com' ||
      /^(?:[a-z0-9-]+\.)?notify\.windows\.com$/.test(u.hostname)
    );
  } catch { return false; }
}
