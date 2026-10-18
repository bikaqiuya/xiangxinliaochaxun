// edge-functions/_lib/auth.js

// ============ 环境变量读取 ============
function _envVar(context, key) {
  if (context && context.env && context.env[key]) return context.env[key];
  if (globalThis[key]) return globalThis[key];
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

// ============ ★ 密码校验（login.js 依赖这个） ============
export async function checkPassword(inputPassword) {
  const expected = globalThis.ADMIN_PASSWORD;
  if (!expected) {
    console.error('[auth] ADMIN_PASSWORD not set!');
    return false;
  }
  return inputPassword === expected;
}

// ============ ★ Cookie 设置（login.js 依赖这个） ============
export function setCookieHeaders(token) {
  const isProd = globalThis.ENVIRONMENT === 'production';
  const maxAge = parseInt(globalThis.SESSION_SECONDS || '86400', 10);
  const cookie = `admin_token=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${isProd ? '; Secure' : ''}`;
  return { 'Set-Cookie': cookie };
}

// ============ Token 生成（修复：自动构造 payload + exp） ============
export async function makeToken(payload) {
  // 如果没传 payload，自动构造
  const pl = payload || {};
  if (!pl.iat) pl.iat = Date.now();
  if (!pl.exp) {
    const ttl = parseInt(globalThis.SESSION_SECONDS || '86400', 10) * 1000;
    pl.exp = Date.now() + ttl;
  }
  if (!pl.sub) pl.sub = 'admin';

  const body = JSON.stringify(pl);
  const sig = await hmac(body);
  return btoa(body) + '.' + sig;
}

// ============ Token 校验 ============
export async function verifyToken(token) {
  if (!token) return null;
  try {
    const [b64, sig] = token.split('.');
    if (!b64 || !sig) return null;
    const body = atob(b64);
    const expect = await hmac(body);
    if (sig !== expect) return null;
    const payload = JSON.parse(body);
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    console.error('[auth] verifyToken error:', e);
    return null;
  }
}

// ============ HMAC 签名 ============
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

// ============ 会话时长 ============
export function getSessionSeconds() {
  const n = parseInt(globalThis.SESSION_SECONDS || '', 10);
  return n > 0 ? n : 86400;
}

// ============ 鉴权中间件 ============
export async function requireAdmin(request) {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/admin_token=([^;]+)/);
  if (!m) return false;
  const payload = await verifyToken(decodeURIComponent(m[1]));
  return !!payload;
}

// ============ 从请求读取 Cookie（兼容） ============
export function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// ============ 清除 Cookie（logout.js 依赖） ============
export function clearCookieHeaders() {
  const isProd = globalThis.ENVIRONMENT === 'production';
  const cookie = `admin_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${isProd ? '; Secure' : ''}`;
  return { 'Set-Cookie': cookie };
}
