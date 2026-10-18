import { json, corsHeaders } from '../../_lib/cors.js';
import { getSpices, saveSpices, normalizeSpice } from '../../_lib/kv.js';
import { requireAdmin, injectEnv } from '../../_lib/auth.js';

const MAX_ITEMS = 500;

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

export async function onRequestPost(context) {
  injectEnv(context);
  if (!(await requireAdmin(context.request))) return json({ error: '需要登录' }, 401);

  let body;
  try { body = await context.request.json(); }
  catch { return json({ error: 'JSON 无效' }, 400); }

  if (!Array.isArray(body)) return json({ error: '请求体必须为数组' }, 400);
  if (body.length === 0) return json({ error: '空数组被阻止（会清空数据）' }, 400);
  if (body.length > MAX_ITEMS) return json({ error: `单次最多 ${MAX_ITEMS} 条` }, 400);

  const seen = new Map();
  const clean = [];
  let skipped = 0;

  for (let i = 0; i < body.length; i++) {
    const { item, error } = (() => {
      const it = normalizeSpice(body[i]);
      if (!it.name) return { error: 'miss_name' };
      if (it.category === 'medicinal' && !it.medicinal.announcement) {
        return { error: `药食同源「${it.name}」缺少公告依据` };
      }
      return { item: it };
    })();

    if (error === 'miss_name') { skipped++; continue; }
    if (error) return json({ error: `第${i + 1}条：${error}` }, 400);

    if (seen.has(item.name)) {
      return json({ error: `重复名称：「${item.name}」`, code: 'DUPLICATE' }, 400);
    }
    seen.set(item.name, true);
    clean.push(item);
  }

  if (clean.length === 0) return json({ error: '清洗后无有效数据' }, 400);

  await saveSpices(clean);
  return json({
    ok: true,
    count: clean.length,
    skipped,
    message: `成功导入 ${clean.length} 条${skipped ? `，跳过 ${skipped} 条` : ''}`
  });
}
