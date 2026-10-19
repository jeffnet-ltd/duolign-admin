// Trimmed copy of the consumer app's frontend/src/api.js -- just the
// request() fetch helper and the admin.* method block. The admin flow
// never actually depends on authHeaders()/getAccessToken()/Supabase in
// the source app either (every admin call passes its bearer token
// explicitly via an Authorization header override, which wins over
// whatever authHeaders() would have set) -- so those imports are
// dropped entirely here rather than pulling in a Supabase client this
// standalone site has no other use for.

const BASE = `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api`

function friendlyRequestFailedMessage(status) {
  return status >= 500
    ? "Something went wrong on our end -- try again in a moment."
    : `Request failed (${status}).`
}

async function request(path, options = {}) {
  let resp
  try {
    resp = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {}),
      },
    })
  } catch {
    throw new Error("Can't reach the server -- check your connection and try again.")
  }
  const isJson = resp.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await resp.json() : null
  if (!resp.ok) {
    const message = data?.detail || friendlyRequestFailedMessage(resp.status)
    const err = new Error(typeof message === 'string' ? message : JSON.stringify(message))
    // Admin.jsx needs to tell "session invalid" (401, sign out) apart
    // from "valid session, insufficient permission" (403, just hide
    // that one section).
    err.status = resp.status
    throw err
  }
  if (!isJson) return null
  return data
}

export const api = {
  admin: {
    login: (email, password) => request('/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    // 2026-10-17: TOTP 2FA, opt-in per admin. login() above returns
    // {mfa_required, pending_token} instead of {token} for an enrolled
    // admin -- this exchanges that plus a code for the real session.
    verifyTotp: (pendingToken, code) => request('/admin/login/verify-totp', {
      method: 'POST', body: JSON.stringify({ pending_token: pendingToken, code }),
    }),
    mfaStatus: (token) => request('/admin/mfa/status', { headers: { Authorization: `Bearer ${token}` } }),
    mfaEnroll: (token) => request('/admin/mfa/enroll', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }),
    mfaConfirm: (token, code) => request('/admin/mfa/confirm', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code }),
    }),
    mfaDisable: (token, password) => request('/admin/mfa/disable', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
    }),
    householdCount: (token) => request('/admin/household-count', { headers: { Authorization: `Bearer ${token}` } }),
    signups: (token) => request('/admin/signups', { headers: { Authorization: `Bearer ${token}` } }),
    waitlist: (token) => request('/admin/waitlist', { headers: { Authorization: `Bearer ${token}` } }),
    syncHealth: (token) => request('/admin/sync-health', { headers: { Authorization: `Bearer ${token}` } }),
    runpodHealth: (token) => request('/admin/runpod-health', { headers: { Authorization: `Bearer ${token}` } }),
    listUsers: (token) => request('/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
    createUser: (token, email, password, role) => request('/admin/users', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email, password, role }),
    }),
    resetPassword: (token, email, password) => request(`/admin/users/${encodeURIComponent(email)}/reset-password`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
    }),
    deleteUser: (token, email) => request(`/admin/users/${encodeURIComponent(email)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    }),
    entitlements: (token) => request('/admin/entitlements', { headers: { Authorization: `Bearer ${token}` } }),
    setEntitlementStatus: (token, householdId, status) => request(`/admin/entitlements/${encodeURIComponent(householdId)}/status`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    }),
    householdTiers: (token) => request('/admin/household-tiers', { headers: { Authorization: `Bearer ${token}` } }),
    metrics: (token, days = 30) => request(`/admin/metrics?days=${days}`, { headers: { Authorization: `Bearer ${token}` } }),
    setHouseholdTier: (token, householdId, tier) => request(`/admin/household-tiers/${encodeURIComponent(householdId)}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tier }),
    }),
    deletionRequests: (token) => request('/admin/deletion-requests', { headers: { Authorization: `Bearer ${token}` } }),
    resolveDeletionRequest: (token, requestId) => request(`/admin/deletion-requests/${encodeURIComponent(requestId)}/resolve`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    }),
    // B2B voucher partnership programme (Couple_finance_app docs/VOUCHER_PROGRAMME_PLAN.md, stage 2).
    partners: (token) => request('/admin/partners', { headers: { Authorization: `Bearer ${token}` } }),
    enrolPartner: (token, body) => request('/admin/partners', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    }),
    updatePartner: (token, partnerId, body) => request(`/admin/partners/${encodeURIComponent(partnerId)}`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    }),
    setEnrolmentWindow: (token, body) => request('/admin/partner-programme/settings', {
      method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    }),
    revokeVoucher: (token, code) => request(`/admin/vouchers/${encodeURIComponent(code)}/revoke`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    }),
    logs: (token, lines) => request(`/admin/logs${lines ? `?lines=${lines}` : ''}`, { headers: { Authorization: `Bearer ${token}` } }),
  },
}
