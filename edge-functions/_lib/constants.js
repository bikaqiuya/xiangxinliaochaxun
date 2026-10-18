// 分类定义
export const CATEGORIES = {
  spice:     { label: '香辛料',   color: '#8b5cf6' },
  seasoning: { label: '调味品',   color: '#f59e0b' },
  medicinal: { label: '药食同源', color: '#10b981' }
};

// 卫健委公告批次（供前端下拉，具体以官网最新公告为准）
export const ANNOUNCEMENTS = [
  '卫法监发〔2002〕51号（87种原目录）',
  '2019年第8号公告（当归等6种）',
  '2023年第9号公告（党参等9种正式纳入）',
  '2024年第4号公告（地黄等4种）',
  '按照传统既是食品又是中药材的物质目录（现行版）'
];

export function categoryMeta(key) {
  return CATEGORIES[key] || CATEGORIES.spice;
}
