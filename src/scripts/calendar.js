/**
 * Booking calendar (client feedback, Nov 2026): a large month view over the season (data/schedule.json), every day
 * showing its tide-based lesson times; picking a day lists its slots. Days without times inside the season can still
 * be booked — the time is confirmed later. Example entries only show while review mode is on.
 */
import { t } from './integrations/config.js';
import { escapeHTML } from './data.js';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

export async function initCalendar(root, config, onChange) {
  const grid = root.querySelector('[data-cal-grid]');
  const monthLabel = root.querySelector('[data-cal-month]');
  const prev = root.querySelector('[data-cal-prev]');
  const next = root.querySelector('[data-cal-next]');
  const slotsBox = root.parentElement.querySelector('[data-slots]');
  const locale = config.locale === 'en' ? 'en-GB' : 'es-ES';
  const monthFmt = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const weekdays = [...Array(7)].map((_, i) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2027, 2, 1 + i))); // 1 Mar 2027 is a Monday

  let data = { season: { from: '2027-03-01', to: '2027-10-31' }, days: {} };
  try {
    const res = await fetch(config.paths.schedule, { cache: 'no-cache' });
    if (res.ok) data = await res.json();
  } catch (err) {
    console.error('schedule', err);
  }
  const days = Object.fromEntries(Object.entries(data.days ?? {}).filter(([, d]) => !d.example || config.reviewMode));
  const today = iso(new Date());
  const from = data.season.from > today ? data.season.from : today;
  const to = data.season.to;
  const first = parse(from);
  const last = parse(to);
  let view = new Date(first.getFullYear(), first.getMonth(), 1);
  let selected = { date: '', time: '' };

  const bookable = (key) => key >= from && key <= to && !days[key]?.closed;

  const renderSlots = () => {
    if (!selected.date) {
      slotsBox.hidden = true;
      return;
    }
    const d = days[selected.date] ?? {};
    const title = escapeHTML(t('slotsFor', { date: dayFmt.format(parse(selected.date)) }));
    const tide = [d.low && `${t('lowTide')} ${d.low}`, d.high && `${t('highTide')} ${d.high}`].filter(Boolean).map(escapeHTML).join(' · ');
    slotsBox.innerHTML = d.slots?.length
      ? `<p class="slots__title">${title}</p>${tide ? `<p class="slots__tide">${tide}</p>` : ''}<div class="slots__list" role="radiogroup" aria-label="${title}">${d.slots
          .map((time, i) => `<label class="slot"><input type="radio" name="slot" value="${escapeHTML(time)}"${selected.time === time ? ' checked' : ''}><span><small>${escapeHTML(t('slotN', { n: i + 1 }))}</small>${escapeHTML(time)}</span></label>`)
          .join('')}</div>`
      : `<p class="slots__title">${title}</p>${tide ? `<p class="slots__tide">${tide}</p>` : ''}<p class="slots__none">${escapeHTML(t('slotsNone'))}</p>`;
    slotsBox.hidden = false;
  };

  const render = () => {
    monthLabel.textContent = monthFmt.format(view);
    prev.disabled = view <= new Date(first.getFullYear(), first.getMonth(), 1);
    next.disabled = view >= new Date(last.getFullYear(), last.getMonth(), 1);
    const lead = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7; // Monday first
    const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    let html = weekdays.map((w) => `<span class="cal__wd" aria-hidden="true">${escapeHTML(w)}</span>`).join('');
    html += '<span class="cal__blank"></span>'.repeat(lead);
    for (let day = 1; day <= count; day++) {
      const key = iso(new Date(view.getFullYear(), view.getMonth(), day));
      const d = days[key];
      const ok = bookable(key);
      const slots = ok && d?.slots?.length ? d.slots : [];
      const cls = ['cal__day', ok ? (slots.length ? 'has-slots' : 'is-tbc') : 'is-off', selected.date === key ? 'is-selected' : ''].filter(Boolean).join(' ');
      const label = `${dayFmt.format(parse(key))}${slots.length ? ` · ${slots.join(', ')}` : ''}`;
      html += `<button type="button" class="${cls}" data-day="${key}"${ok ? '' : ' disabled'} aria-pressed="${selected.date === key}" aria-label="${escapeHTML(label)}"><span class="cal__num">${day}</span>${slots
        .map((s, i) => `<span class="cal__slot"><small>${escapeHTML(t('slotN', { n: i + 1 }))}</small> ${escapeHTML(s)}</span>`)
        .join('')}</button>`;
    }
    grid.innerHTML = html;
  };

  const select = (date, time = '') => {
    selected = { date, time };
    render();
    renderSlots();
    onChange({ ...selected });
  };

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-day]');
    if (!btn || btn.disabled) return;
    const slots = days[btn.dataset.day]?.slots ?? [];
    select(btn.dataset.day, slots.length === 1 ? slots[0] : '');
  });
  slotsBox.addEventListener('change', (e) => {
    if (e.target.name !== 'slot') return;
    selected.time = e.target.value;
    onChange({ ...selected });
  });
  prev.addEventListener('click', () => {
    view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
    render();
  });
  next.addEventListener('click', () => {
    view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    render();
  });
  render();

  return {
    value: () => ({ ...selected }),
    hasSlots: (date) => Boolean(days[date]?.slots?.length),
    reset: () => select(''),
  };
}
