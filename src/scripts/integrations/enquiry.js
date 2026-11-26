/**
 * Delivery of booking requests / enquiries.
 *
 * site.config.json → enquiry.provider:
 *   "none"       demo mode: nothing is sent and the visitor is told so (default until configured)
 *   "formspree"  POST JSON to enquiry.endpoint (https://formspree.io/f/xxxx)
 *   "webhook"    POST JSON to enquiry.endpoint (your own API, Make/Zapier, CRM, or server/enquiry.mjs)
 *   "netlify"    Netlify Forms (site hosted on Netlify; endpoint ignored)
 *   "formsubmit" FormSubmit (https://formsubmit.co/ajax/<academy email or FormSubmit alias>): each booking or message
 *                arrives as an email to the academy. No account: the first submission sends the academy one
 *                "Activate Form" email, and nothing is delivered until it is clicked.
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
    if (provider === 'formsubmit') {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(forEmail(payload)),
        signal: controller.signal,
      });
      // FormSubmit answers 200 with { success: "false" } while the form is not activated
      const data = await res.json().catch(() => ({}));
      return res.ok && String(data.success) === 'true' ? { ok: true, reference: null } : { ok: false, reason: 'server', status: res.status };
    }
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

/** The email the academy receives (always in Spanish), one row per detail; the visitor's email is the reply-to. */
function forEmail(p) {
  const v = p.display ?? {};
  const rows =
    p.type === 'booking'
      ? {
          Clase: p.plan?.name,
          Duración: v.option,
          Fecha: v.date,
          Hora: v.time,
          Personas: p.participants,
          Nivel: v.level,
          'Precio estimado': v.total,
          Nombre: p.contact?.name,
          Teléfono: p.contact?.phone,
          Mensaje: p.message,
        }
      : { Nombre: p.contact?.name, Teléfono: p.contact?.phone, Mensaje: p.message };
  const out = {
    _subject: p.type === 'booking' ? `Solicitud de reserva: ${p.plan?.name ?? ''} · ${v.date ?? ''} · ${p.contact?.name ?? ''}` : `Mensaje de la web: ${p.contact?.name ?? ''}`,
    _template: 'table',
    _captcha: 'false',
  };
  for (const [k, val] of Object.entries(rows)) if (val !== undefined && val !== null && String(val).trim() !== '') out[k] = String(val);
  out.email = p.contact?.email ?? '';
  out['Idioma de la web'] = p.locale === 'en' ? 'Inglés' : 'Castellano';
  return out;
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
