import { processWarriorPlusIpn, IpnError } from '../_lib/warriorplus.js';

// POST https://<your-domain>/api/ipn/warriorplus
// Web-standard handler: request.formData() reads both multipart/form-data (what WarriorPlus sends)
// and application/x-www-form-urlencoded; JSON is accepted too. The Node (req, res) signature
// left multipart bodies unparsed, so every IPN arrived with no fields.
async function readFields(request: Request): Promise<Record<string, string>> {
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    const json = await request.json().catch(() => ({}));
    return Object.fromEntries(Object.entries(json || {}).map(([k, v]) => [k, String(v ?? '')]));
  }
  if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
    const form = await request.formData();
    const out: Record<string, string> = {};
    form.forEach((v, k) => {
      if (typeof v === 'string') out[k] = v;
    });
    return out;
  }
  // Unknown/missing content type: try url-encoded text
  const text = await request.text();
  return Object.fromEntries(new URLSearchParams(text));
}

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, string> = {};
  try {
    body = await readFields(request);
  } catch (e: any) {
    console.error('[WarriorPlus IPN Error] could not read body', e?.message || e);
    return new Response('Rejected', { status: 400 });
  }

  // Diagnostics without secrets: which fields arrived and whether a key was present
  console.log(
    '[WarriorPlus IPN] received',
    JSON.stringify({
      contentType: request.headers.get('content-type') || '',
      fields: Object.keys(body),
      keyLength: String(body.WP_SECURITYKEY ?? '').trim().length,
    })
  );

  try {
    const result = await processWarriorPlusIpn(body);
    // Never log the security key; email + txn are enough to trace a sale
    console.log('[WarriorPlus IPN]', result.status, result.email, result.txnId, result.tier);
    return new Response('OK', { status: 200 });
  } catch (error: any) {
    const status = error instanceof IpnError ? error.httpStatus : 500;
    console.error('[WarriorPlus IPN Error]', status, error?.message || error);
    // 5xx makes WarriorPlus retry later (e.g. a Firestore hiccup); 4xx means the request itself is bad
    return new Response(status >= 500 ? 'Temporary error' : 'Rejected', { status });
  }
}

export function GET(): Response {
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}
