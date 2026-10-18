function _envVar(context, key) {
  // 1. 优先 context.env（Makers 传入）
  if (context && context.env && context.env[key]) return context.env[key];
  // 2. 全局注入（login/import/export 里 injectEnv 写过 globalThis）
  if (globalThis[key]) return globalThis[key];
  // 3. 兜底
  if (typeof self !== 'undefined' && self[key]) return self[key];
  return undefined;
}

export function injectEnv(context) {
  for (const k of ['ADMIN_PASSWORD', 'AUTH_SECRET', 'SESSION_SECONDS', 'ENVIRONMENT']) {
    const v = _envVar(context, k);
    if (v) globalThis[k] = v;
  }
}

function getSecret() {
  return globalThis.AUTH_SECRET || 'dev-secret-change-me';
}

export function getPassword() {
  return globalThis.ADMIN_PASSWORD || 'changeme';
}

// 简单 HMAC 签名 token（Web Crypto，V8 可用）
async function hmac(message) {
  const enc = new TextEncoder().encode(message);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc);
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function makeToken(payload) {
  const body = JSON.stringify(payload);
  const sig = await hmac(body);
  return btoa(body) + '.' + sig;
}

export async function verifyToken(token) {
  if (!token) return null;
  try {
    const [b64, sig] = token.split('.');
    const body = atob(b64);
    const expect = await hmac(body);
    if (sig !== expect) return null;
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export function getSessionSeconds() {
  const n = parseInt(globalThis.SESSION_SECONDS || '', 10);
  return n > 0 ? n : 86400;
}

export async function requireAdmin(request) {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/admin_token=([^;]+)/);
  if (!m) return false;
  const payload = await verifyToken(decodeURIComponent(m[1]));
  if (!payload) return false;
  if (payload.exp && Date.now() > payload.exp) return false;
  return true;
}
