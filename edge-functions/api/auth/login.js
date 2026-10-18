import { json, corsHeaders } from '../../_lib/cors.js';
import { makeToken, setCookieHeaders, checkPassword } from '../../_lib/auth.js';

// ============ 环境变量注入 ============
function injectEnv(context) {
  if (context && context.env) {
    // 支持多种环境变量名（ADMIN_PASSWORD / PASSWORD）
    const pwd = context.env.ADMIN_PASSWORD || context.env.PASSWORD;
    if (pwd) globalThis.ADMIN_PASSWORD = pwd;
    
    if (context.env.AUTH_SECRET) globalThis.AUTH_SECRET = context.env.AUTH_SECRET;
    if (context.env.SESSION_SECONDS) globalThis.SESSION_SECONDS = context.env.SESSION_SECONDS;
    if (context.env.ENVIRONMENT) globalThis.ENVIRONMENT = context.env.ENVIRONMENT;
  }
}

// ============ 常量 ============
const MAX_FAILS = 5;
const FAIL_TTL = 900;
const FAIL_KEY_PREFIX = '__auth_fails__';

// ============ OPTIONS 预检 ============
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      ...corsHeaders(),
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// ============ POST 登录 ============
export async function onRequestPost(context) {
  const { request } = context;

  // ★ 注入环境变量
  injectEnv(context);

  // ★ 从 context.env 获取 KV 实例（不再依赖全局变量）
  const KV = context.env.SPICE_KV;

  const baseHeaders = {
    ...corsHeaders(),
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  // 1. 解析请求体
  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: '请求格式无效' }, 400, baseHeaders);
  }

  const password = String(body.password || '');
  if (!password) {
    return json({ error: '请输入密码' }, 400, baseHeaders);
  }

  // 2. 获取客户端 IP
  const ip = request.headers.get('cf-connecting-ip') 
    || request.headers.get('x-forwarded-for') 
    || request.headers.get('x-real-ip') 
    || 'unknown';
  const failsKey = `${FAIL_KEY_PREFIX}${ip}`;

  // 3. 限流检查（KV 可用时才启用）
  if (KV) {
    try {
      let fails = 0;
      const failsVal = await KV.get(failsKey);
      if (failsVal) {
        fails = parseInt(failsVal, 10) || 0;
      }
      if (fails >= MAX_FAILS) {
        return json({ 
          error: `登录失败次数过多，请 ${Math.ceil(FAIL_TTL / 60)} 分钟后再试` 
        }, 429, baseHeaders);
      }

      // 4. 验证密码
      const ok = await checkPassword(password);
      if (!ok) {
        fails += 1;
        await KV.put(failsKey, String(fails), { expirationTtl: FAIL_TTL });
        return json({ 
          error: '密码错误',
          remaining: MAX_FAILS - fails
        }, 401, baseHeaders);
      }

      // 5. 登录成功：清除失败计数
      try { await KV.delete(failsKey); } catch (_) {}

    } catch (kvErr) {
      console.error('KV operation error:', kvErr);
      // KV 出错时 fallback：仅验证密码
      const ok = await checkPassword(password);
      if (!ok) {
        return json({ error: '密码错误' }, 401, baseHeaders);
      }
    }
  } else {
    // ★ KV 不可用时直接验证密码（无限制流）
    console.warn('SPICE_KV not bound, skipping rate limit');
    const ok = await checkPassword(password);
    if (!ok) {
      return json({ error: '密码错误' }, 401, baseHeaders);
    }
  }

  // 6. 生成 token 并设置 cookie
  try {
    const token = await makeToken();
    const cookieHeaders = setCookieHeaders(token);

    return new Response(JSON.stringify({ ok: true, message: '登录成功' }), {
      status: 200,
      headers: {
        ...baseHeaders,
        ...cookieHeaders,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  } catch (err) {
    console.error('Token generation error:', err);
    return json({ error: '登录处理失败，请重试' }, 500, baseHeaders);
  }
}
