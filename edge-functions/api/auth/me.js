import { json, corsHeaders } from '../../_lib/cors.js';
import { requireAdmin } from '../../_lib/auth.js';

// ============ 环境变量注入（Makers 关键修复） ============
function injectEnv(context) {
  if (context && context.env) {
    if (context.env.ADMIN_PASSWORD) globalThis.ADMIN_PASSWORD = context.env.ADMIN_PASSWORD;
    if (context.env.AUTH_SECRET) globalThis.AUTH_SECRET = context.env.AUTH_SECRET;
    if (context.env.SESSION_SECONDS) globalThis.SESSION_SECONDS = context.env.SESSION_SECONDS;
    if (context.env.ENVIRONMENT) globalThis.ENVIRONMENT = context.env.ENVIRONMENT;
  }
}

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

// ============ GET 校验状态 ============
export async function onRequestGet(context) {
  injectEnv(context);

  const headers = {
    ...corsHeaders(),
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  try {
    const ok = await requireAdmin(context.request);

    if (ok) {
      return json({ 
        authenticated: true,
        username: '管理员'
      }, 200, headers);
    } else {
      return json({ 
        authenticated: false, 
        error: '未登录或会话已过期' 
      }, 401, headers);
    }
  } catch (err) {
    console.error('Auth me error:', err);
    return json({ 
      authenticated: false, 
      error: '鉴权检查失败，请重试' 
    }, 500, headers);
  }
}
