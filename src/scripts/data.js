let request;

/** data/plans.json, fetched once per page (the booking form and the server read the same file). */
export function loadPlans(config) {
  request ??= fetch(config.paths.plans, { cache: 'no-cache' }).then((res) => {
    if (!res.ok) throw new Error(`plans ${res.status}`);
    return res.json();
  });
  return request.catch((err) => {
    request = undefined; // allow a retry
    throw err;
  });
}

export const escapeHTML = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
