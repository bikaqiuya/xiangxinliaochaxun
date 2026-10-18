import { json, corsHeaders } from '../../_lib/cors.js';
import { getSpices } from '../../_lib/kv.js';
import { requireAdmin, injectEnv } from '../../_lib/auth.js';

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

export async function onRequestGet(context) {
  injectEnv(context);
  if (!(await requireAdmin(context.request))) return json({ error: '需要登录' }, 401);

  const url = new URL(context.request.url);

  // 药食同源空模板
  if (url.searchParams.get('template') === 'medicinal') {
    return json([{
      name: '',
      category: 'medicinal',
      botanical: '',
      part: '',
      note: '',
      medicinal: {
        alias: '', officialName: '', announcement: '', announcementNo: '',
        announceDate: '', basis: '', isPilot: false,
        pilotRegions: '', usageLimit: '', safetyNote: ''
      }
    }], 200, corsHeaders());
  }

  const list = await getSpices();
  const headers = {
    ...corsHeaders(),
    'Cache-Control': 'no-store'
  };

  if (url.searchParams.get('download') === '1') {
    const fn = `spices_${new Date().toISOString().slice(0, 10)}.json`;
    headers['Content-Disposition'] = `attachment; filename="${fn}"`;
    headers['Content-Type'] = 'application/json; charset=utf-8';
  }

  return new Response(JSON.stringify(list, null, 2), { status: 200, headers });
}
