// edge-functions/api/spices/import.js

import { json, corsHeaders } from '../../_lib/cors.js';
import { getSpices, saveSpices, normalizeSpice } from '../../_lib/kv.js';
import { requireAdmin, injectEnv } from '../../_lib/auth.js';

// ============ OPTIONS 预检 ============
export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

// ============ POST 导入（合并模式） ============
export async function onRequestPost(context) {
  injectEnv(context);
  if (!(await requireAdmin(context.request))) return json({ error: '需要登录' }, 401);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'JSON 无效' }, 400);
  }

  if (!Array.isArray(body)) {
    return json({ error: '导入数据必须为数组' }, 400);
  }

  if (body.length === 0) {
    return json({ error: '导入数据为空' }, 400);
  }

  // 1. 读取现有数据
  const existing = await getSpices();

  // 2. 对导入数组内部去重（同名只保留最后一条）
  const importMap = new Map();
  for (const raw of body) {
    const item = normalizeSpice(raw);
    if (!item.name) continue; // 跳过无名称的脏数据
    importMap.set(item.name, item);
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;

  // 3. 逐条合并
  for (const item of importMap.values()) {
    const idx = existing.findIndex(x => x.name === item.name);
    if (idx !== -1) {
      // 已存在 → 更新（保留原有 id）
      item.id = existing[idx].id || item.id;
      existing[idx] = item;
      updated++;
    } else {
      // 不存在 → 新增
      existing.push(item);
      added++;
    }
  }

  // 4. 写回 KV
  try {
    await saveSpices(existing);
  } catch (e) {
    return json({ error: '写入失败：' + e.message }, 500);
  }

  return json({
    ok: true,
    message: `导入完成：新增 ${added} 条，更新 ${updated} 条，跳过 ${skipped} 条`,
    added,
    updated,
    skipped,
    total: existing.length
  });
}
