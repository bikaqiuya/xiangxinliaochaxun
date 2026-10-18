const KV_KEY = 'spices';

// 字段归一化：老数据缺字段也不崩
export function normalizeSpice(item = {}) {
  const m = item.medicinal || {};
  return {
    name: String(item.name || '').trim(),
    category: ['spice', 'seasoning', 'medicinal'].includes(item.category) ? item.category : 'spice',
    botanical: String(item.botanical || '').trim(),
    part: String(item.part || '').trim(),
    note: String(item.note || '').trim(),
    std12729: String(item.std12729 || '').trim(),
    std21725: String(item.std21725 || '').trim(),
    medicinal: {
      alias: String(m.alias || '').trim(),
      officialName: String(m.officialName || item.name || '').trim(),
      announcement: String(m.announcement || '').trim(),
      announcementNo: String(m.announcementNo || '').trim(),
      announceDate: String(m.announceDate || '').trim(),
      basis: String(m.basis || '').trim(),
      isPilot: !!m.isPilot,
      pilotRegions: String(m.pilotRegions || '').trim(),
      usageLimit: String(m.usageLimit || '').trim(),
      safetyNote: String(m.safetyNote || '').trim()
    }
  };
}

export async function getSpices() {
  try {
    const raw = await my_kv.get(KV_KEY, { type: 'json' });
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeSpice);
  } catch (e) {
    console.error('getSpices error:', e);
    return [];
  }
}

export async function saveSpices(list) {
  // V8 运行时：直接传对象，SDK 会序列化；为稳妥手动 stringify
  await my_kv.put(KV_KEY, JSON.stringify(list));
}
