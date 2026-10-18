// edge-functions/api/spices.js

import { json, corsHeaders } from '../_lib/cors.js';
import { getSpices, saveSpices, normalizeSpice } from '../_lib/kv.js';
import { requireAdmin, injectEnv } from '../_lib/auth.js';

const MAX_NAME_LEN = 100;

// ============ 从 URL 路径中提取 name ============
function extractPathParam(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname; // e.g. /api/spices/xxx 或 /api/spices
  const parts = pathname.split('/').filter(Boolean);
  // parts = ['api', 'spices', 'xxx']
  if (parts.length >= 3) {
    return decodeURIComponent(parts[2]);
  }
  return null;
}

// ============ 校验 & 清洗 ============
function cleanItem(body) {
  const item = normalizeSpice(body);
  item.name = item.name.slice(0, MAX_NAME_LEN);
  if (!item.name) return { error: 'name 不能为空' };

  // 药食同源必须填公告依据（安全访问）
  if (item.category === 'medicinal') {
    if (!item.medicinal || !item.medicinal.announcement) {
      return { error: `药食同源品种「${item.name}」必须填写公告依据` };
    }
  }
  return { item };
}

// ============ OPTIONS 预检 ============
export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

// ============ GET 列表（公开） ============
export async function onRequestGet(context) {
  injectEnv(context); // ← 加这一行，确保 KV 绑定可用
  const list = await getSpices();
  const url = new URL(context.request.url);
  const cat = url.searchParams.get('category');
  const filtered = cat ? list.filter(x => x.category === cat) : list;
  return json(filtered);
}

// ============ POST 新增 ============
export async function onRequestPost(context) {
  injectEnv(context);
  if (!(await requireAdmin(context.request))) return json({ error: '需要登录' }, 401);

  let body;
  try { body = await context.request.json(); }
  catch { return json({ error: 'JSON 无效' }, 400); }

  const { item, error } = cleanItem(body);
  if (error) return json({ error }, 400);

  const list = await getSpices();
  if (list.some(x => x.name === item.name)) {
    return json({ error: `已存在同名品种：${item.name}` }, 409);
  }
  list.push(item);
  await saveSpices(list);
  return json({ ok: true, count: list.length, item });
}

// ============ PUT 更新（支持 /api/spices/{name} 路径参数） ============
export async function onRequestPut(context) {
  injectEnv(context);
  if (!(await requireAdmin(context.request))) return json({ error: '需要登录' }, 401);

  let body;
  try { body = await context.request.json(); }
  catch { return json({ error: 'JSON 无效' }, 400); }

  const { item, error } = cleanItem(body);
  if (error) return json({ error }, 400);

  const list = await getSpices();

  // 优先从 URL 路径参数定位
  const pathParam = extractPathParam(context);
  let idx = -1;
  if (pathParam) {
    idx = list.findIndex(x => x.name === pathParam);
  }
  // 如果路径参数没找到，用 body 里的 name 定位
  if (idx === -1) {
    idx = list.findIndex(x => x.name === item.name);
  }

  if (idx === -1) return json({ error: '未找到该品种' }, 404);

  // 如果改了 name，检查新 name 是否与其他记录冲突
  if (item.name !== list[idx].name && list.some(x => x.name === item.name)) {
    return json({ error: `已存在同名品种：${item.name}` }, 409);
  }

  list[idx] = item;
  await saveSpices(list);
  return json({ ok: true, item });
}

// ============ DELETE 删除（支持 /api/spices/{name} 路径参数） ============
export async function onRequestDelete(context) {
  injectEnv(context);
  if (!(await requireAdmin(context.request))) return json({ error: '需要登录' }, 401);

  // 从路径参数获取 name
  const pathParam = extractPathParam(context);
  if (!pathParam) {
    // fallback: 尝试从 query string 读
    const url = new URL(context.request.url);
    const name = url.searchParams.get('name');
    if (!name) return json({ error: '缺少品种标识（路径参数或 ?name=）' }, 400);
    const list = await getSpices();
    const next = list.filter(x => x.name !== name);
    if (next.length === list.length) return json({ error: '未找到该品种' }, 404);
    await saveSpices(next);
    return json({ ok: true, count: next.length });
  }

  // 用路径参数（name）删除
  const list = await getSpices();
  const next = list.filter(x => x.name !== pathParam);
  if (next.length === list.length) return json({ error: '未找到该品种' }, 404);
  await saveSpices(next);
  return json({ ok: true, count: next.length });
}
