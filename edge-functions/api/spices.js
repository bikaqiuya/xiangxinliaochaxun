import { json, corsHeaders } from '../../_lib/cors.js';
import { getSpices, saveSpices, normalizeSpice } from '../../_lib/kv.js';
import { requireAdmin, injectEnv } from '../../_lib/auth.js';

const MAX_NAME_LEN = 100;

function cleanItem(body) {
  const item = normalizeSpice(body);
  item.name = item.name.slice(0, MAX_NAME_LEN);
  if (!item.name) return { error: 'name 不能为空' };

  // 药食同源必须填公告依据
  if (item.category === 'medicinal') {
    if (!item.medicinal.announcement) {
      return { error: `药食同源品种「${item.name}」必须填写公告依据` };
    }
  }
  return { item };
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

// GET 列表（公开，供前台展示）
export async function onRequestGet(context) {
  const list = await getSpices();
  const url = new URL(context.request.url);
  const cat = url.searchParams.get('category');
  const filtered = cat ? list.filter(x => x.category === cat) : list;
  return json(filtered);
}

// POST 新增
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
  return json({ ok: true, count: list.length });
}

// PUT 更新（按 name 定位）
export async function onRequestPut(context) {
  injectEnv(context);
  if (!(await requireAdmin(context.request))) return json({ error: '需要登录' }, 401);

  let body;
  try { body = await context.request.json(); }
  catch { return json({ error: 'JSON 无效' }, 400); }

  const { item, error } = cleanItem(body);
  if (error) return json({ error }, 400);

  const list = await getSpices();
  const idx = list.findIndex(x => x.name === item.name);
  if (idx === -1) return json({ error: '未找到该品种' }, 404);
  list[idx] = item;
  await saveSpices(list);
  return json({ ok: true });
}

// DELETE 删除
export async function onRequestDelete(context) {
  injectEnv(context);
  if (!(await requireAdmin(context.request))) return json({ error: '需要登录' }, 401);

  const url = new URL(context.request.url);
  const name = url.searchParams.get('name');
  if (!name) return json({ error: '缺少 name 参数' }, 400);

  const list = await getSpices();
  const next = list.filter(x => x.name !== name);
  if (next.length === list.length) return json({ error: '未找到该品种' }, 404);
  await saveSpices(next);
  return json({ ok: true, count: next.length });
}
