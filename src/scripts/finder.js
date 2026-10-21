/** "Which lesson is right for me?" — two questions, one suggestion, linked to the booking form. */
import { t } from './integrations/config.js';

const LEVEL_FOR_FORM = { beginner: 'beginner', 'beginner-plus': 'beginner', intermediate: 'intermediate', advanced: 'advanced' };

function suggest(who, level) {
  if (who === 'adaptive') return { plan: 'adaptive', why: 'whyAdaptive' };
  if (who === 'kids') return { plan: 'kids', why: 'whyKids' };
  if (who === 'group') return { plan: 'group', why: 'whyGroup' };
  if (level === 'beginner-plus') return { plan: 'courses', why: 'whyCourses' };
  return { plan: 'private', why: level === 'beginner' ? 'whyPrivateNew' : 'whyPrivate' };
}

export default function initFinder(root, config) {
  const form = root.querySelector('[data-finder-form]');
  const out = root.querySelector('[data-finder-output]');
  const placeholder = root.querySelector('[data-finder-placeholder]');

  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('change', () => {
    const who = form.elements.who.value;
    const level = form.elements.level.value;
    if (!who || !level) return;
    const { plan, why } = suggest(who, level);
    root.querySelector('[data-finder-plan]').textContent = `${t(`planName_${plan}`)} · ${t(`level_${LEVEL_FOR_FORM[level]}`)}`;
    root.querySelector('[data-finder-why]').textContent = t(why);
    root.querySelector('[data-finder-book]').href = `${config.paths.contact}?plan=${plan}&level=${LEVEL_FOR_FORM[level]}#booking`;
    root.querySelector('[data-finder-more]').href = `#${plan}`;
    placeholder.hidden = true;
    out.hidden = false;
  });
}
