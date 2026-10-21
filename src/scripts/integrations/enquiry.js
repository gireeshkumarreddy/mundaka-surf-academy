/**
 * Delivery of booking requests / enquiries.
 *
 * site.config.json → enquiry.provider:
 *   "none"       demo mode: nothing is sent and the visitor is told so (default until configured)
 *   "formspree"  POST JSON to enquiry.endpoint (https://formspree.io/f/xxxx)
 *   "webhook"    POST JSON to enquiry.endpoint (your own API, Make/Zapier, CRM, or server/enquiry.mjs)
 *   "netlify"    Netlify Forms (site hosted on Netlify; endpoint ignored)
 */
export function enquiryConfigured(config) {
  const { provider, endpoint } = config.enquiry ?? {};
  if (provider === 'netlify') return true;
  return Boolean(provider && provider !== 'none' && endpoint);
}

export async function sendEnquiry(config, payload, { timeoutMs = 15000 } = {}) {
  if (!enquiryConfigured(config)) return { ok: false, reason: 'not-configured' };
  const { provider, endpoint } = config.enquiry;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res;
    if (provider === 'netlify') {
      const body = new URLSearchParams({ 'form-name': 'booking', ...flatten(payload) });
      res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: controller.signal });
    } else {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    }
    if (!res.ok) return { ok: false, reason: 'server', status: res.status };
    let data = {};
    try {
      data = await res.json();
    } catch {
      /* some providers answer with an empty body */
    }
    return { ok: true, reference: data.reference ?? null };
  } catch (err) {
    return { ok: false, reason: err.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
  }
  return out;
}
