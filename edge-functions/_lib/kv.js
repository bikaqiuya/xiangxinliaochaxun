// edge-functions/_lib/kv.js

const KEY = 'spices';
const MAX_ITEMS = 1000;

// ============ 延迟获取 KV 绑定（必须在 injectEnv 之后调用） ============
function getKV() {
  const kv = globalThis.SPICE_KV;
  if (!kv) {
    console.error('[kv] SPICE_KV not found! Make sure injectEnv(context) is called before any KV operation.');
    throw new Error('SPICE_KV 未初始化，请检查环境变量配置');
  }
  return kv;
}

// ============ 数据标准化（统一版本，兼容所有字段） ============
// 关键设计：std12729/std21725 等标准字段始终在根级别，
// 药食同源品种（category=medicinal）也能携带香辛料标准信息
export function normalizeSpice(data) {
  if (!data) return {};

  const item = {
    id: data.id || crypto.randomUUID(),
    name: String(data.name || '').trim(),
    pinyin: data.pinyin || '',
    // 分类：spice=香辛料, seasoning=调味品, medicinal=药食同源
    category: ['spice', 'seasoning', 'medicinal'].includes(data.category) ? data.category : 'spice',
    latin: data.latin || data.botanical || '',  // 兼容旧字段
    family: data.family || '',
    part: String(data.part || '').trim(),
    flavor: data.flavor || '',
    nature: data.nature || '',
    functions: data.functions || '',
    usage: data.usage || '',
    notes: data.notes || data.note || '',       // 兼容旧字段
    // 香辛料标准字段（根级别，药食同源品种也保留）
    std12729: data.std12729 || '',
    std21725: data.std21725 || '',
    tags: Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };

  // 药食同源额外字段（子对象，仅 medicinal 分类构建）
  if (item.category === 'medicinal') {
    item.medicinal = {
      alias: data.medicinal?.alias || '',
      officialName: data.medicinal?.officialName || item.name,
      announcement: data.medicinal?.announcement || data.announcement || '',
      announcementNo: data.medicinal?.announcementNo || '',
      announceDate: data.medicinal?.announceDate || '',
      basis: data.medicinal?.basis || '按照传统既是食品又是中药材的物质目录',
      isPilot: Boolean(data.medicinal?.isPilot),
      pilotRegions: data.medicinal?.pilotRegions || '',
      usageLimit: data.medicinal?.usageLimit || data.restriction || '按传统方式适量食用',
      maxDose: data.medicinal?.maxDose || data.maxDose || '',
      scope: data.medicinal?.scope || data.scope || '',
      safetyNote: data.medicinal?.safetyNote || '',
    };
  }

  return item;
}

// ============ 读取香辛料数据 ============
export async function getSpices() {
  const KV = getKV();
  const raw = await KV.get(KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(normalizeSpice) : [];
  } catch (e) {
    console.error('[kv] JSON parse error:', e);
    return [];
  }
}

// ============ 写入香辛料数据 ============
export async function saveSpices(list) {
  const KV = getKV();
  if (!Array.isArray(list)) throw new Error('数据必须为数组');
  if (list.length > MAX_ITEMS) throw new Error(`超出最大限制 ${MAX_ITEMS}`);

  const cleaned = list.map(normalizeSpice);
  await KV.put(KEY, JSON.stringify(cleaned));
}

// ============ 导出常量 ============
export { MAX_ITEMS };
