/**
 * hours.js — Personal Hours widget for Digambar Singh (Piyush Kumar)
 *
 * Birth time: 10:30 AM → Birth Time Number = 4, Transition Minute = :30.
 * Every personal hour flips at :30 past the clock hour.
 * The numerological "day" starts at 11 PM (hours since 11 PM + 4, then reduce).
 *
 * Each hour is mapped to a comedy-writing/performing discipline.
 * The widget updates the clock every second (for the HH:MM display) and
 * re-renders the hour card on :30 transitions.
 */

/* -------------------------------------------------------------------------
 * Personal Hour table — 24 windows, keyed by "hours since 11 PM" (0..23)
 * ------------------------------------------------------------------------- */

const HOUR_TABLE = [
  // idx = hours since 11 PM
  { startHour: 23, num: 4,  name: 'Structure Hour',     action: 'Review notes, organise material',       avoid: false, master: false },
  { startHour: 0,  num: 5,  name: 'Adventure Hour',     action: 'Late-night experiments, crowd-work mindset', avoid: false, master: false },
  { startHour: 1,  num: 6,  name: 'Caregiver Hour',     action: 'Too nice — sanitises jokes',             avoid: true,  master: false },
  { startHour: 2,  num: 7,  name: 'Analyst Hour',       action: 'Edit, cut, ruthless critical review',    avoid: false, master: false },
  { startHour: 3,  num: 8,  name: 'Power Hour',         action: 'Bold material, no-apology writing',      avoid: false, master: false },
  { startHour: 4,  num: 9,  name: 'Completion Hour',    action: 'Will go preachy — avoid drafting',       avoid: true,  master: false },
  { startHour: 5,  num: 1,  name: 'Pioneer Hour',       action: 'Originality, lead with new premises',    avoid: false, master: false },
  { startHour: 6,  num: 11, name: 'Master Vision Hour', action: 'Premise hunting — spot patterns, odd connections', avoid: false, master: true },
  { startHour: 7,  num: 3,  name: 'Expression Hour',    action: 'Draft setups and punchlines',            avoid: false, master: false },
  { startHour: 8,  num: 4,  name: 'Structure Hour',     action: 'Organise, list-build, outline bits',     avoid: false, master: false },
  { startHour: 9,  num: 5,  name: 'Adventure Hour',     action: 'Loose ideas, unconventional angles',     avoid: false, master: false },
  { startHour: 10, num: 6,  name: 'Caregiver Hour',     action: 'Sanitises jokes, makes them nice',       avoid: true,  master: false },
  { startHour: 11, num: 7,  name: 'Analyst Hour',       action: 'Cut weakest line — ruthless edit',       avoid: false, master: false },
  { startHour: 12, num: 8,  name: 'Power Hour',         action: 'Edgy material, no-apology',              avoid: false, master: false },
  { startHour: 13, num: 9,  name: 'Completion Hour',    action: 'Will go preachy — avoid',                avoid: true,  master: false },
  { startHour: 14, num: 1,  name: 'Pioneer Hour',       action: 'Launch new premises, bold openings',     avoid: false, master: false },
  { startHour: 15, num: 2,  name: 'Diplomatic Hour',    action: 'Punchlines soften — avoid writing',      avoid: true,  master: false },
  { startHour: 16, num: 3,  name: 'Expression Hour',    action: 'Rehearse out loud, time your bits',      avoid: false, master: false },
  { startHour: 17, num: 22, name: 'Master Builder Hour',action: 'Build a set — structure, callbacks',     avoid: false, master: true },
  { startHour: 18, num: 5,  name: 'Adventure Hour',     action: 'Loose openers, warm cold rooms',         avoid: false, master: false },
  { startHour: 19, num: 6,  name: 'Caregiver Hour',     action: 'Will soften punches — avoid on stage',   avoid: true,  master: false },
  { startHour: 20, num: 7,  name: 'Analyst Hour',       action: 'Watch other comics, analyse the room',   avoid: false, master: false },
  { startHour: 21, num: 8,  name: 'Power Hour',         action: '⭐ PRIME SLOT — command the room',       avoid: false, master: false, prime: true },
  { startHour: 22, num: 9,  name: 'Completion Hour',    action: 'Late-night philosophising — avoid',      avoid: true,  master: false },
];

/* Build a quick lookup: startHour (0..23) → table row */
const BY_START_HOUR = {};
for (const row of HOUR_TABLE) BY_START_HOUR[row.startHour] = row;

/* -------------------------------------------------------------------------
 * Compute current personal hour window, given a Date
 * ------------------------------------------------------------------------- */

/**
 * Given a Date, figure out which window we're in.
 * A personal hour runs from HH:30 to (HH+1):30.
 * If current minute < 30, we're in the window that started at (HH-1):30.
 * If current minute >= 30, we're in the window that started at HH:30.
 */
function computePersonalHour(now = new Date()) {
  const h = now.getHours();
  const m = now.getMinutes();

  // Determine the clock-hour that this window STARTED at.
  const windowStartHour = (m < 30) ? ((h + 23) % 24) : h;
  // Window ends one clock-hour later.
  const windowEndHour = (windowStartHour + 1) % 24;

  const row = BY_START_HOUR[windowStartHour];

  return {
    ...row,
    windowStartHour,
    windowEndHour,
    // Human-readable window string, e.g. "5:30 PM to 6:30 PM"
    windowLabel: `${formatHour(windowStartHour, 30)} to ${formatHour(windowEndHour, 30)}`,
  };
}

function formatHour(h, m) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm} ${ampm}`;
}

function formatNow(now = new Date()) {
  const h = now.getHours();
  const m = now.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm} ${ampm}`;
}

/* -------------------------------------------------------------------------
 * Rendering
 * ------------------------------------------------------------------------- */

/** Returns the HTML string for the widget, including wrappers and IDs for auto-update. */
function renderWidgetHTML() {
  const now = new Date();
  const ph = computePersonalHour(now);

  const masterBadge = ph.master ? `<span class="ph-master">MASTER</span>` : '';
  const primeBadge  = ph.prime ? `<span class="ph-prime">PRIME</span>` : '';
  const avoidClass  = ph.avoid ? 'ph-avoid' : '';
  const masterClass = ph.master ? 'ph-master-card' : '';

  return `
    <div class="ph-widget ${avoidClass} ${masterClass}" id="ph-widget">
      <div class="ph-clock" id="ph-clock">${formatNow(now)}</div>
      <div class="ph-window" id="ph-window">${ph.windowLabel}</div>
      <div class="ph-name" id="ph-name">
        ${masterBadge}${primeBadge}${escapeHTML(ph.name)}
        ${ph.avoid ? '<span class="ph-avoid-tag">avoid</span>' : ''}
      </div>
      <div class="ph-action" id="ph-action">${escapeHTML(ph.action)}</div>
    </div>
  `;
}

function escapeHTML(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/**
 * Auto-update a widget that is already in the DOM.
 * - Updates the clock text every second (cheap DOM write).
 * - Re-renders the whole card when the window changes (on :30 transitions).
 * Returns a stop function to clear the interval.
 */
function startAutoUpdate() {
  let currentStartHour = computePersonalHour().windowStartHour;

  const tick = () => {
    const widget = document.getElementById('ph-widget');
    if (!widget) return;

    const now = new Date();
    const ph = computePersonalHour(now);

    // Always update the clock text
    const clockEl = document.getElementById('ph-clock');
    if (clockEl) clockEl.textContent = formatNow(now);

    // If the window changed, re-render the whole card
    if (ph.windowStartHour !== currentStartHour) {
      currentStartHour = ph.windowStartHour;
      // Preserve the outer node, replace inner content
      widget.className = `ph-widget ${ph.avoid ? 'ph-avoid' : ''} ${ph.master ? 'ph-master-card' : ''}`.trim();
      const windowEl = document.getElementById('ph-window');
      const nameEl   = document.getElementById('ph-name');
      const actionEl = document.getElementById('ph-action');
      if (windowEl) windowEl.textContent = ph.windowLabel;
      if (nameEl) {
        const masterBadge = ph.master ? `<span class="ph-master">MASTER</span>` : '';
        const primeBadge  = ph.prime ? `<span class="ph-prime">PRIME</span>` : '';
        nameEl.innerHTML = `${masterBadge}${primeBadge}${escapeHTML(ph.name)}${ph.avoid ? '<span class="ph-avoid-tag">avoid</span>' : ''}`;
      }
      if (actionEl) actionEl.textContent = ph.action;
    }
  };

  const interval = setInterval(tick, 1000);
  return () => clearInterval(interval);
}

const Hours = {
  renderWidgetHTML,
  startAutoUpdate,
  computePersonalHour,
  HOUR_TABLE,
};

export default Hours;
export { renderWidgetHTML, startAutoUpdate, computePersonalHour, HOUR_TABLE };
