/**
 * Plans page: plan tabs + framed photo + detail panel (fifth reference) and the comparison table.
 * Everything comes from data/plans.json.
 */
import { t, local } from './integrations/config.js';
import { loadPlans, escapeHTML, imageUrl, planRows } from './data.js';

export default async function initPlans(root, config) {
  const tabs = root.querySelector('[data-plan-tabs]');
  const panel = root.querySelector('[data-plan-panel]');
  const photo = root.querySelector('[data-plan-photo]');
  const compare = document.querySelector('[data-plans-compare]');
  const updated = document.querySelector('[data-plans-updated]');
  const goForm = root.querySelector('[data-plan-go]');
  let plans = [];
  let current;

  const contactUrl = (id) => `${config.paths.contact}?plan=${encodeURIComponent(id)}#booking`;

  const showError = () => {
    const html = `<p class="plans-error">${escapeHTML(t('plansError'))}</p><button type="button" class="btn btn--white btn--sm" data-retry>${escapeHTML(t('retry'))}</button>`;
    tabs.innerHTML = '';
    panel.innerHTML = html;
    if (compare) compare.innerHTML = `<p class="plans-error plans-error--dark">${escapeHTML(t('plansError'))}</p>`;
    panel.querySelector('[data-retry]').addEventListener('click', () => {
      panel.innerHTML = `<p class="plan-panel__status">${escapeHTML(t('plansLoading'))}</p>`;
      start();
    });
  };

  const select = (id, { focus = false, updateUrl = true } = {}) => {
    current = plans.find((p) => p.id === id) ?? plans[0];
    tabs.querySelectorAll('[role="tab"]').forEach((tab) => {
      const on = tab.dataset.id === current.id;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    });
    panel.setAttribute('aria-labelledby', `tab-${current.id}`);
    panel.innerHTML = `
      <p class="plan-panel__eyebrow">${escapeHTML(t(`format_${current.format}`))}</p>
      <h2 class="plan-panel__name">${escapeHTML(local(current.name))}</h2>
      <p class="plan-panel__summary">${escapeHTML(local(current.summary))}</p>
      <dl class="plan-panel__rows">${planRows(current, config)
        .filter(([label]) => label !== t('rowAvailability'))
        .map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${value}</dd></div>`)
        .join('')}</dl>
      <a class="btn btn--accent btn--pill btn--lg" href="${contactUrl(current.id)}" data-magnetic><svg class="icon" aria-hidden="true"><use href="#i-calendar"/></svg>${escapeHTML(t('requestPlan'))}</a>`;
    const img = photo.querySelector('img');
    img.removeAttribute('srcset');
    img.src = imageUrl(config, current.image);
    img.alt = '';
    photo.classList.remove('is-swapping');
    void photo.offsetWidth;
    photo.classList.add('is-swapping');
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('plan', current.id);
      history.replaceState(null, '', url);
    }
  };

  const renderTabs = () => {
    tabs.innerHTML = plans
      .map((p) => `<button type="button" role="tab" class="plan-tab" id="tab-${p.id}" data-id="${p.id}" aria-controls="plan-panel">${escapeHTML(local(p.name))}</button>`)
      .join('');
    panel.id = 'plan-panel';
    tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('[role="tab"]');
      if (tab) select(tab.dataset.id);
    });
    tabs.addEventListener('keydown', (e) => {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!(e.key in keys) && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      const i = plans.findIndex((p) => p.id === current.id);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? plans.length - 1 : (i + keys[e.key] + plans.length) % plans.length;
      select(plans[next].id, { focus: true });
    });
  };

  const renderCompare = () => {
    if (!compare) return;
    const rows = plans.map((p) => planRows(p, config));
    const labels = rows[0].map(([label]) => label);
    compare.innerHTML = `
      <table class="compare__table">
        <caption class="visually-hidden">${escapeHTML(t('compareCaption'))}</caption>
        <thead><tr><th scope="col"><span class="visually-hidden">${escapeHTML(t('rowPlan'))}</span></th>${plans
          .map((p) => `<th scope="col"><img src="${imageUrl(config, p.image)}" alt="" loading="lazy" width="800" height="533"><span>${escapeHTML(local(p.name))}</span></th>`)
          .join('')}</tr></thead>
        <tbody>${labels
          .map((label, r) => `<tr><th scope="row">${escapeHTML(label)}</th>${rows.map((cols) => `<td>${cols[r][1]}</td>`).join('')}</tr>`)
          .join('')}
          <tr class="compare__actions"><th scope="row"><span class="visually-hidden">${escapeHTML(t('requestPlan'))}</span></th>${plans
            .map((p) => `<td><a class="btn btn--sm btn--pill" href="${contactUrl(p.id)}">${escapeHTML(t('requestShort'))}<span class="visually-hidden"> — ${escapeHTML(local(p.name))}</span></a></td>`)
            .join('')}</tr>
        </tbody>
      </table>`;
  };

  goForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = goForm.elements.email;
    const error = root.querySelector('[data-plan-go-error]');
    const email = input.value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    error.hidden = true;
    input.removeAttribute('aria-invalid');
    try {
      sessionStorage.setItem('msa:prefill', JSON.stringify({ email, plan: current?.id }));
    } catch {
      /* storage blocked: the form simply starts empty */
    }
    window.location.assign(contactUrl(current?.id ?? ''));
  });

  async function start() {
    try {
      const data = await loadPlans(config);
      plans = (data.plans ?? []).filter((p) => p.bookable !== false);
      if (!plans.length) throw new Error('no plans');
      renderTabs();
      renderCompare();
      if (updated && data.updated) {
        updated.textContent = t('updatedOn', { date: new Intl.DateTimeFormat(config.locale === 'es' ? 'es-ES' : 'en-GB', { dateStyle: 'long' }).format(new Date(data.updated)) });
      }
      const wanted = new URLSearchParams(window.location.search).get('plan');
      select(wanted, { updateUrl: false });
    } catch (err) {
      console.error(err);
      showError();
    }
  }
  start();
}
