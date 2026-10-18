// edge-functions/_lib/kv.js
const KV = SPICE_KV; // 已根据控制台绑定名修改

const KEY = 'spices';
const MAX_ITEMS = 1000;

// 数据标准化（兼容老数据与药食同源新字段）
function normalizeSpice(item) {
  const category = ['spice', 'medicinal'].includes(item.category) ? item.category : 'spice';
  
  const base = {
    name: String(item.name || '').trim(),
    category,
    botanical: String(item.botanical || '').trim(),
    part: String(item.part || '').trim(),
    note: String(item.note || '').trim(),
    std12729: String(item.std12729 || '').trim(),
    std21725: String(item.std21725 || '').trim()
  };

  // 如果是药食同源分类，补充 medicinal 字段
  if (category === 'medicinal') {
    base.medicinal = {
      alias: String(item.medicinal?.alias || ''),
      officialName: String(item.medicinal?.officialName || base.name),
      announcement: String(item.medicinal?.announcement || ''),
      announcementNo: String(item.medicinal?.announcementNo || ''),
      announceDate: String(item.medicinal?.announceDate || ''),
      basis: String(item.medicinal?.basis || '按照传统既是食品又是中药材的物质目录'),
      isPilot: Boolean(item.medicinal?.isPilot),
      pilotRegions: String(item.medicinal?.pilotRegions || ''),
      usageLimit: String(item.medicinal?.usageLimit || '按传统方式适量食用'),
      safetyNote: String(item.medicinal?.safetyNote || '')
    };
  }

  return base;
}

// 读取香辛料数据
export async function getSpices() {
  const raw = await KV.get(KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(normalizeSpice) : [];
  } catch (e) {
    console.error('KV JSON parse error:', e);
    return [];
  }
}

// 写入香辛料数据
export async function saveSpices(list) {
  if (!Array.isArray(list)) throw new Error('数据必须为数组');
  if (list.length > MAX_ITEMS) throw new Error(`超出最大限制 ${MAX_ITEMS}`);
  
  const cleaned = list.map(normalizeSpice);
  await KV.put(KEY, JSON.stringify(cleaned));
}

// 导出常量供其他文件使用
export { MAX_ITEMS };
