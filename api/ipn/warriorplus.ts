import { processWarriorPlusIpn, IpnError } from '../_lib/warriorplus.js';

// POST https://<your-domain>/api/ipn/warriorplus
// WarriorPlus sends application/x-www-form-urlencoded; Vercel parses it into req.body.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let body: Record<string, any> = req.body || {};
  if (typeof body === 'string') body = Object.fromEntries(new URLSearchParams(body));

  try {
    const result = await processWarriorPlusIpn(body);
    // Never log the security key; email + txn are enough to trace a sale
    console.log('[WarriorPlus IPN]', result.status, result.email, result.txnId, result.tier);
    return res.status(200).send('OK');
  } catch (error: any) {
    const status = error instanceof IpnError ? error.httpStatus : 500;
    console.error('[WarriorPlus IPN Error]', status, error?.message || error);
    // 5xx makes WarriorPlus retry later (e.g. a Firestore hiccup); 4xx means the request itself is bad
    return res.status(status).send(status >= 500 ? 'Temporary error' : 'Rejected');
  }
}
