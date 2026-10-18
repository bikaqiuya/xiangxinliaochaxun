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

  // 读取现有数据
  const existing = await getSpices();
  const existingNames = new Set(existing.map(x => x.name));

  const seen = new Map();
  const clean = [];
  let skipped = 0;
  let updated = 0;

  for (let i = 0; i < body.length; i++) {
    const { item, error } = (() => {
      const it = normalizeSpice(body[i]);
      if (!it.name) return { error: 'miss_name' };
      // 安全访问 medicinal（非药食同源可能没有该字段）
      if (it.category === 'medicinal' && (!it.medicinal || !it.medicinal.announcement)) {
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

    // 统计更新数量
    if (existingNames.has(item.name)) {
      updated++;
    }

    clean.push(item);
  }

  if (clean.length === 0) return json({ error: '清洗后无有效数据' }, 400);

  // 合并：过滤掉被更新的旧记录，追加新/更新后的记录
  const filtered = existing.filter(x => !clean.some(c => c.name === x.name));
  const merged = [...filtered, ...clean];

  await saveSpices(merged);
  return json({
    ok: true,
    added: clean.length - updated,
    updated,
    skipped,
    total: merged.length,
    message: `成功导入 ${clean.length} 条（新增 ${clean.length - updated}，更新 ${updated}）${skipped ? `，跳过 ${skipped} 条` : ''}`
  });
}
