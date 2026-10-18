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

export async function onRequestGet(context) {
  // 1. 注入 Makers 环境变量
  injectEnv(context);

  // 2. 构建响应头：CORS + 严格防缓存
  const headers = {
    ...corsHeaders(),
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  try {
    // 3. 校验登录状态
    const ok = await requireAdmin(context.request);

    if (ok) {
      // 已登录：返回认证状态及用户名
      return json({ 
        authenticated: true,
        username: '管理员'
      }, 200, headers);
    } else {
      // 未登录或会话无效：返回 401
      return json({ 
        authenticated: false, 
        error: '未登录或会话已过期' 
      }, 401, headers);
    }
  } catch (err) {
    // 兜底错误处理
    console.error('Auth me error:', err);
    return json({ 
      authenticated: false, 
      error: '鉴权检查失败，请重试' 
    }, 500, headers);
  }
}
