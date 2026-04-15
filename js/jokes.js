/**
 * jokes.js — Joke CRUD, search, filtering, sorting, favorites, copy
 *
 * v7 schema:
 *   joke.beats      — [{ setup, punchlines: [string, ...] }]   (at least one beat; first punchline is the main one, rest are "tags")
 *   joke.categories — [string]                                  (filters applied to this joke; was joke.category, single string)
 *   joke.labels     — [string]                                  (user's topic labels; was joke.tags)
 *
 * Legacy jokes (with joke.setup / joke.punchline / joke.category / joke.tags)
 * are normalized on read via normalizeJoke() and re-saved in new shape on next edit.
 */

import DB from './db.js';
import UI from './ui.js';
import Captures from './captures.js';
import Performances from './performances.js';
import Hours from './hours.js';

const CATEGORIES = [
  'Irony', 'Character', 'Shock', 'Hyperbole', 'Wordplay',
  'Reference', 'Madcap', 'Parody', 'Analogy', 'Misplaced focus',
  'Meta humor', 'One-liner', 'Other'
];

const METHODS = [
  'Filtering', 'Finessing', 'Conjuring out of nothing'
];

// Set Assignment — which "tight" set(s) a joke belongs to. Multi-select.
// "Retired" is handled separately via pipelineStage (lifecycle, not a set).
const SET_ASSIGNMENTS = ['Tight 5', 'Tight 10', 'Tight 20', 'Experimental'];

// Maps a set-assignment label to a CSS modifier for its badge color
function setBadgeClass(name) {
  switch (name) {
    case 'Tight 5':      return 'badge-set-tight5';
    case 'Tight 10':     return 'badge-set-tight10';
    case 'Tight 20':     return 'badge-set-tight20';
    case 'Experimental': return 'badge-set-exp';
    default: return '';
  }
}

// Pipeline Stage — lifecycle of a joke. Ordered progression.
const PIPELINE_STAGES = [
  { value: 'raw',       label: 'Raw idea'       },
  { value: 'drafted',   label: 'Drafted'        },
  { value: 'workshop',  label: 'Workshopped'    },
  { value: 'rotation',  label: 'In Rotation'    },
  { value: 'tight',     label: 'Tight Material' },
  { value: 'retired',   label: 'Retired'        },
];

// Maps a pipeline stage value to a CSS modifier for its badge color
function pipelineBadgeClass(stage) {
  switch (stage) {
    case 'raw':      return 'badge-raw';
    case 'drafted':  return 'badge-drafted';
    case 'workshop': return 'badge-workshop';
    case 'rotation': return 'badge-rotation';
    case 'tight':    return 'badge-tight';
    case 'retired':  return 'badge-retired';
    default: return 'badge-drafted';
  }
}

function pipelineLabel(value) {
  return PIPELINE_STAGES.find(s => s.value === value)?.label || 'Drafted';
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'best', label: 'Best rated' },
  { value: 'most-performed', label: 'Most performed' },
];

// Current filter/sort state (persists while app is open)
let currentFilters = {
  query: '',
  pipelineStage: 'all',   // lifecycle stage filter (was "status")
  setAssignment: 'all',   // Tight 5/10/20/Experimental filter
  categories: [],         // multi-select
  sort: 'newest',
};

// Cache perf stats to avoid re-fetching during sort
let perfStatsCache = {};

// Keeps the Personal Hours widget interval — cleared on each re-render
let hoursStopper = null;

/* =========================================================================
 * Schema normalization — keeps old jokes readable and uniforms the new shape
 * ========================================================================= */

/** Convert any joke (legacy or new) into the canonical v7 shape. Non-destructive: returns a new object. */
function normalizeJoke(joke) {
  if (!joke) return joke;
  const n = { ...joke };

  // beats[]
  if (!Array.isArray(n.beats) || n.beats.length === 0) {
    const punchline = typeof n.punchline === 'string' ? n.punchline : '';
    n.beats = [{
      setup: typeof n.setup === 'string' ? n.setup : '',
      punchlines: punchline ? [punchline] : [''],
    }];
  } else {
    // Defensive: ensure each beat has the expected shape
    n.beats = n.beats.map(b => ({
      setup: typeof b?.setup === 'string' ? b.setup : '',
      punchlines: Array.isArray(b?.punchlines) && b.punchlines.length > 0
        ? b.punchlines.map(p => (typeof p === 'string' ? p : ''))
        : [''],
    }));
  }

  // categories[]
  if (!Array.isArray(n.categories)) {
    n.categories = (typeof n.category === 'string' && n.category) ? [n.category] : [];
  }

  // labels[]
  if (!Array.isArray(n.labels)) {
    n.labels = Array.isArray(n.tags) ? [...n.tags] : [];
  }

  // setAssignments[] — new field. Default empty for legacy jokes.
  if (!Array.isArray(n.setAssignments)) n.setAssignments = [];

  // pipelineStage — new field. Migrate legacy "status" if missing.
  //   draft    → drafted
  //   polished → rotation
  //   retired  → retired
  if (!n.pipelineStage) {
    if (n.status === 'polished') n.pipelineStage = 'rotation';
    else if (n.status === 'retired') n.pipelineStage = 'retired';
    else if (n.status === 'draft') n.pipelineStage = 'drafted';
    else n.pipelineStage = 'drafted';
  }

  return n;
}

/** Get the first setup (for preview / sorting / export heading) */
function firstSetup(joke) {
  return joke?.beats?.[0]?.setup || '';
}
/** Get the first punchline (for preview) */
function firstPunchline(joke) {
  return joke?.beats?.[0]?.punchlines?.[0] || '';
}
/** Flatten all text in a joke for searching */
function allJokeText(joke) {
  const parts = [joke.premise || ''];
  for (const b of (joke.beats || [])) {
    parts.push(b.setup || '');
    for (const p of (b.punchlines || [])) parts.push(p || '');
  }
  parts.push(...(joke.labels || []));
  return parts.join(' ').toLowerCase();
}
/** Count extras beyond the first setup+punchline (for "+N more" badge) */
function extrasCount(joke) {
  const beats = joke.beats || [];
  if (beats.length === 0) return 0;
  // Extra beats after the first, plus extra punchlines in beat 1
  const extraBeats = beats.length - 1;
  const extraPunchlinesBeat1 = Math.max(0, (beats[0].punchlines?.length || 1) - 1);
  return extraBeats + extraPunchlinesBeat1;
}

/* ========================================================================= */

function matchesSearch(joke, query) {
  if (!query) return true;
  return allJokeText(joke).includes(query.toLowerCase());
}

function applyFilters(jokes) {
  return jokes.filter(joke => {
    if (!matchesSearch(joke, currentFilters.query)) return false;
    if (currentFilters.pipelineStage !== 'all' && joke.pipelineStage !== currentFilters.pipelineStage) return false;
    if (currentFilters.setAssignment !== 'all') {
      const sets = joke.setAssignments || [];
      if (!sets.includes(currentFilters.setAssignment)) return false;
    }
    if (currentFilters.categories.length > 0) {
      const jokeCats = joke.categories || [];
      if (!currentFilters.categories.some(c => jokeCats.includes(c))) return false;
    }
    return true;
  });
}

function applySortAndPin(jokes) {
  // Pinned jokes always first, then sort within each group
  const pinned = jokes.filter(j => j.pinned);
  const unpinned = jokes.filter(j => !j.pinned);

  const sortFn = getSortFn(currentFilters.sort);
  pinned.sort(sortFn);
  unpinned.sort(sortFn);

  return [...pinned, ...unpinned];
}

function getSortFn(sortKey) {
  switch (sortKey) {
    case 'oldest':
      return (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt);
    case 'best':
      return (a, b) => {
        const sa = perfStatsCache[a.id]?.avg || 0;
        const sb = perfStatsCache[b.id]?.avg || 0;
        return sb - sa || new Date(b.updatedAt) - new Date(a.updatedAt);
      };
    case 'most-performed':
      return (a, b) => {
        const ca = perfStatsCache[a.id]?.count || 0;
        const cb = perfStatsCache[b.id]?.count || 0;
        return cb - ca || new Date(b.updatedAt) - new Date(a.updatedAt);
      };
    default: // newest
      return (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt);
  }
}

/* =========================================================================
 * Filter chip bar (Option C, multi-select) — shared component for list view
 * ========================================================================= */

function renderFilterChipBarHTML() {
  const selected = currentFilters.categories;
  return `
    <div class="chipbar-wrap" id="filter-chipbar">
      <div class="chipbar-selected" id="filter-chipbar-selected">
        ${selected.map(f => `
          <span class="selected-chip">${UI.esc(f)}<button type="button" data-remove="${UI.esc(f)}" aria-label="Remove">×</button></span>
        `).join('')}
      </div>
      <button type="button" class="add-filter-trigger" id="filter-chipbar-trigger">
        ${selected.length === 0 ? '+ Filter by...' : '+ Add filter'}
      </button>
      <div class="search-pop" id="filter-chipbar-pop">
        <input type="text" id="filter-chipbar-search" placeholder="Search filters...">
        <div id="filter-chipbar-opts"></div>
      </div>
    </div>
  `;
}

function bindFilterChipBar(onChange) {
  const wrap = document.getElementById('filter-chipbar');
  if (!wrap) return;
  const trigger = document.getElementById('filter-chipbar-trigger');
  const pop = document.getElementById('filter-chipbar-pop');
  const search = document.getElementById('filter-chipbar-search');
  const opts = document.getElementById('filter-chipbar-opts');
  const selected = document.getElementById('filter-chipbar-selected');

  function renderOpts() {
    const q = search.value.toLowerCase();
    const matches = CATEGORIES.filter(f => f.toLowerCase().includes(q));
    opts.innerHTML = matches.length === 0
      ? `<div class="search-pop-empty">No filters match</div>`
      : matches.map(f => `
          <div class="opt ${currentFilters.categories.includes(f) ? 'selected' : ''}" data-v="${UI.esc(f)}">
            <span class="tick">✓</span>${UI.esc(f)}
          </div>
        `).join('');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    pop.classList.toggle('open');
    if (pop.classList.contains('open')) {
      search.value = '';
      renderOpts();
      search.focus();
    }
  });
  search.addEventListener('input', renderOpts);
  opts.addEventListener('click', (e) => {
    const opt = e.target.closest('.opt');
    if (!opt) return;
    const v = opt.dataset.v;
    const idx = currentFilters.categories.indexOf(v);
    if (idx >= 0) currentFilters.categories.splice(idx, 1);
    else currentFilters.categories.push(v);
    onChange();
  });
  selected.addEventListener('click', (e) => {
    const v = e.target.dataset?.remove;
    if (v) {
      const idx = currentFilters.categories.indexOf(v);
      if (idx >= 0) currentFilters.categories.splice(idx, 1);
      onChange();
    }
  });
  // Close popover on outside click
  document.addEventListener('click', function onDocClick(e) {
    if (!wrap.contains(e.target)) pop.classList.remove('open');
  });
}

/* =========================================================================
 * Main Jokes module
 * ========================================================================= */

const Jokes = {
  /** Render the joke list view */
  async renderList() {
    const rawJokes = await DB.getAll('jokes');
    const allJokes = rawJokes.map(normalizeJoke);

    // Pre-fetch all perf stats for sorting
    perfStatsCache = {};
    await Promise.all(allJokes.map(async (joke) => {
      perfStatsCache[joke.id] = await Performances.getStats(joke.id);
    }));

    const filtered = applyFilters(allJokes);
    const sorted = applySortAndPin(filtered);
    const app = document.getElementById('app-content');

    const hasFilters = currentFilters.query
      || currentFilters.status !== 'all'
      || currentFilters.categories.length > 0;

    const sortOptions = SORT_OPTIONS.map(s =>
      `<option value="${s.value}" ${currentFilters.sort === s.value ? 'selected' : ''}>${s.label}</option>`
    ).join('');

    app.innerHTML = `
      ${Hours.renderWidgetHTML()}

      <div class="view-header">
        <h1>My Jokes</h1>
        <span class="joke-count">${allJokes.length} joke${allJokes.length !== 1 ? 's' : ''}</span>
      </div>

      ${allJokes.length > 0 ? `
        <div class="search-bar">
          <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="text" id="search-input" placeholder="Search jokes..." value="${UI.esc(currentFilters.query)}">
          ${currentFilters.query ? '<button class="search-clear" id="search-clear">&times;</button>' : ''}
        </div>

        <div class="filter-row">
          <div class="filter-chips filter-chips-scroll" id="pipeline-filters">
            <button class="filter-chip ${currentFilters.pipelineStage === 'all' ? 'active' : ''}" data-stage="all">All</button>
            ${PIPELINE_STAGES.map(s => `
              <button class="filter-chip ${currentFilters.pipelineStage === s.value ? 'active' : ''}" data-stage="${s.value}">${s.label}</button>
            `).join('')}
          </div>
          <div class="filter-dropdowns">
            <select class="filter-select" id="sort-select">
              ${sortOptions}
            </select>
          </div>
        </div>

        <div class="filter-row">
          <div class="filter-chips filter-chips-scroll" id="setassign-filters">
            <button class="filter-chip ${currentFilters.setAssignment === 'all' ? 'active' : ''}" data-setassign="all">All sets</button>
            ${SET_ASSIGNMENTS.map(s => `
              <button class="filter-chip ${currentFilters.setAssignment === s ? 'active' : ''}" data-setassign="${UI.esc(s)}">${UI.esc(s)}</button>
            `).join('')}
          </div>
        </div>

        <div class="filter-row" style="margin-top:-4px">
          ${renderFilterChipBarHTML()}
        </div>
      ` : ''}

      ${allJokes.length === 0 ? UI.emptyState(
        '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15.5 11a3.5 3.5 0 1 0-7 0"/><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/></svg>',
        'No jokes yet',
        'Tap + to write your first joke'
      ) : sorted.length === 0 ? UI.emptyState(
        '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
        'No matches',
        'Try a different search or filter'
      ) : `
        <div class="joke-list" id="joke-list-container">
          ${sorted.map(joke => Jokes.renderCard(joke, perfStatsCache[joke.id])).join('')}
        </div>
        ${hasFilters ? `<p class="filter-count">Showing ${sorted.length} of ${allJokes.length}</p>` : ''}
      `}
    `;

    Jokes.bindListEvents();
  },

  /** Render a single joke card */
  renderCard(joke, stats) {
    const setup = firstSetup(joke);
    const punchline = firstPunchline(joke);
    const extras = extrasCount(joke);
    const extrasBadge = extras > 0 ? `<span class="beat-more">+${extras} more</span>` : '';

    const cats = joke.categories || [];
    const catBadges = cats.slice(0, 2).map(c => UI.categoryBadge(c)).join('');
    const catMore = cats.length > 2 ? `<span class="badge badge-category">+${cats.length - 2}</span>` : '';

    // Set assignment badges (Tight 5 / 10 / 20 / Experimental)
    const setBadges = (joke.setAssignments || [])
      .map(s => `<span class="badge badge-set ${setBadgeClass(s)}">${UI.esc(s)}</span>`)
      .join('');

    // Pipeline stage badge
    const stage = joke.pipelineStage || 'drafted';
    const stageBadge = `<span class="badge ${pipelineBadgeClass(stage)}">${UI.esc(pipelineLabel(stage))}</span>`;

    return `
      <div class="joke-card" data-id="${joke.id}">
        <div class="joke-card-header">
          <button class="btn-pin ${joke.pinned ? 'pinned' : ''}" data-pin-id="${joke.id}" aria-label="Pin" onclick="event.stopPropagation()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${joke.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </button>
          ${stageBadge}
          ${setBadges}
          ${catBadges}${catMore}
          ${Performances.renderStatsInline(stats)}
          <span class="joke-date">${UI.formatDate(joke.updatedAt)}</span>
        </div>
        <div class="joke-card-body" onclick="window.location.hash='#/editor/${joke.id}'">
          ${joke.premise ? `<div class="joke-preview-line"><span class="label-mini">P</span> ${UI.esc(UI.truncate(joke.premise, 60))}</div>` : ''}
          ${setup ? `<div class="joke-preview-line"><span class="label-mini">S</span> ${UI.esc(UI.truncate(setup, 60))}</div>` : ''}
          ${punchline ? `<div class="joke-preview-line"><span class="label-mini">PL</span> ${UI.esc(UI.truncate(punchline, 60))}${extrasBadge}</div>` : ''}
        </div>
        ${joke.labels && joke.labels.length > 0 ? `<div class="joke-card-tags" onclick="window.location.hash='#/editor/${joke.id}'">${UI.tagChips(joke.labels)}</div>` : ''}
      </div>
    `;
  },

  /** Bind events for search, filters, sort, and pin */
  bindListEvents() {
    // Start the Personal Hours widget auto-update (clear any prior one first)
    if (hoursStopper) { hoursStopper(); hoursStopper = null; }
    if (document.getElementById('ph-widget')) {
      hoursStopper = Hours.startAutoUpdate();
    }

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          currentFilters.query = e.target.value;
          Jokes.renderList();
        }, 200);
      });
      if (currentFilters.query) {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
      }
    }

    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        currentFilters.query = '';
        Jokes.renderList();
      });
    }

    document.querySelectorAll('#pipeline-filters .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        currentFilters.pipelineStage = chip.dataset.stage;
        Jokes.renderList();
      });
    });

    document.querySelectorAll('#setassign-filters .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        currentFilters.setAssignment = chip.dataset.setassign;
        Jokes.renderList();
      });
    });

    bindFilterChipBar(() => Jokes.renderList());

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        currentFilters.sort = e.target.value;
        Jokes.renderList();
      });
    }

    // Pin toggle buttons
    document.querySelectorAll('.btn-pin').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.pinId;
        const joke = await DB.get('jokes', id);
        if (joke) {
          joke.pinned = !joke.pinned;
          await DB.put('jokes', joke);
          Jokes.renderList();
        }
      });
    });
  },

  /** Render the joke editor view */
  async renderEditor(jokeId, prefill) {
    let raw = null;
    if (jokeId) {
      raw = await DB.get('jokes', jokeId);
      if (!raw) {
        UI.toast('Joke not found');
        window.location.hash = '#/jokes';
        return;
      }
    }
    const joke = raw ? normalizeJoke(raw) : null;

    const isNew = !joke;
    const app = document.getElementById('app-content');

    const methodOptions = METHODS.map(m =>
      `<option value="${m}" ${joke && joke.method === m ? 'selected' : ''}>${m}</option>`
    ).join('');

    const premiseVal = prefill?.premise || (joke ? (joke.premise || '') : '');

    // Beats to pre-populate in the editor
    const beatsToRender = joke
      ? joke.beats
      : [{ setup: '', punchlines: [''] }];

    // Categories chip state for the editor (local to this view)
    let editorCats = joke ? [...(joke.categories || [])] : [];

    // Set assignment chip state for the editor
    let editorSets = joke ? [...(joke.setAssignments || [])] : [];

    const pipelineOptions = PIPELINE_STAGES.map(s =>
      `<option value="${s.value}" ${joke && joke.pipelineStage === s.value ? 'selected' : ''}>${s.label}</option>`
    ).join('');

    app.innerHTML = `
      <div class="editor-header">
        <button class="btn-icon" onclick="window.location.hash='#/jokes'" aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <h2>${isNew ? 'New Joke' : 'Edit Joke'}</h2>
        <div class="editor-actions">
          ${!isNew ? `
            <button class="btn-icon" id="btn-copy" aria-label="Copy joke" title="Copy to clipboard">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            </button>
            <button class="btn-icon ${joke.pinned ? 'pin-active' : ''}" id="btn-pin-editor" aria-label="Pin joke">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="${joke.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </button>
            <button class="btn-icon btn-delete" id="btn-delete" aria-label="Delete">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>
            </button>
          ` : ''}
        </div>
      </div>

      <form id="joke-form" class="joke-form">
        <div class="form-group">
          <label for="method">Method</label>
          <select id="method">
            <option value="">Choose...</option>
            ${methodOptions}
          </select>
        </div>

        <div class="form-group">
          <label for="premise">Premise <span class="label-hint">— the observation behind the joke</span></label>
          <textarea id="premise" class="premise-box" rows="1" placeholder="The truth behind the joke...">${UI.esc(premiseVal)}</textarea>
        </div>

        <div id="beats-container"></div>

        <button type="button" class="btn-add-beat" id="btn-add-beat">
          <span style="font-size: 1.2rem; line-height: 1;">+</span> Add beat
        </button>

        <div class="form-group">
          <label>Filter <span class="label-hint">— pick one or more comedy techniques</span></label>
          <div class="chipbar-wrap" id="editor-chipbar">
            <div class="chipbar-selected" id="editor-chipbar-selected"></div>
            <button type="button" class="add-filter-trigger" id="editor-chipbar-trigger">+ Add filter</button>
            <div class="search-pop" id="editor-chipbar-pop">
              <input type="text" id="editor-chipbar-search" placeholder="Search filters...">
              <div id="editor-chipbar-opts"></div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="pipeline-stage">Pipeline Stage <span class="label-hint">— where this joke is in its lifecycle</span></label>
          <select id="pipeline-stage">
            ${pipelineOptions}
          </select>
        </div>

        <div class="form-group">
          <label>Set Assignment <span class="label-hint">— tag which tight sets this belongs to</span></label>
          <div class="set-chips" id="editor-set-chips">
            ${SET_ASSIGNMENTS.map(s => `
              <button type="button" class="set-chip ${editorSets.includes(s) ? 'active' : ''}" data-set="${UI.esc(s)}">${UI.esc(s)}</button>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label for="labels">Labels <span class="label-hint">comma-separated — e.g. relationships, work, food</span></label>
          <input type="text" id="labels" placeholder="e.g. relationships, work, food" value="${joke && joke.labels ? UI.esc(joke.labels.join(', ')) : ''}">
        </div>

        <button type="submit" class="btn btn-primary btn-full">
          ${isNew ? 'Save Joke' : 'Update Joke'}
        </button>
      </form>

      ${!isNew ? `<div id="perf-container"></div>` : ''}
    `;

    // ---- Beats rendering & interactions ----
    const beatsContainer = document.getElementById('beats-container');

    function beatHTML(idx, beat, removable) {
      const punchlines = beat.punchlines || [''];
      const firstP = punchlines[0] || '';
      const tagRows = punchlines.slice(1).map((p, i) => tagHTML(i + 1, p)).join('');
      return `
        <div class="beat" data-beat="${idx}">
          <div class="beat-label">
            <span>Beat ${idx}</span>
            ${removable ? `<button type="button" class="beat-remove" aria-label="Remove beat">×</button>` : ''}
          </div>
          <div class="form-group">
            <label>Setup</label>
            <textarea class="beat-setup" rows="2" placeholder="How you lead the audience in...">${UI.esc(beat.setup || '')}</textarea>
          </div>
          <div class="form-group">
            <label>Punchline</label>
            <textarea class="beat-punchline" rows="2" placeholder="The twist, the payoff...">${UI.esc(firstP)}</textarea>
          </div>
          <div class="tags-list">${tagRows}</div>
          <button type="button" class="btn-add-tag" aria-label="Add tag">
            <span style="font-size: 1rem; line-height: 1;">+</span> Add tag
          </button>
        </div>
      `;
    }

    function tagHTML(tagIdx, value = '') {
      return `
        <div class="tag-row form-group">
          <label>Tag ${tagIdx} <span class="label-hint" style="font-size:0.7rem">— another punchline off the same setup</span></label>
          <textarea class="beat-tag" rows="2" placeholder="Another punchline...">${UI.esc(value)}</textarea>
          <button type="button" class="tag-remove" aria-label="Remove tag">×</button>
        </div>
      `;
    }

    function paintBeats() {
      beatsContainer.innerHTML = beatsToRender
        .map((b, i) => beatHTML(i + 1, b, i > 0))
        .join('');
    }

    function renumberBeats() {
      [...beatsContainer.querySelectorAll('.beat')].forEach((el, i) => {
        el.dataset.beat = i + 1;
        el.querySelector('.beat-label span').textContent = `Beat ${i + 1}`;
        const removeBtn = el.querySelector('.beat-remove');
        if (i === 0 && removeBtn) removeBtn.remove();
        if (i > 0 && !removeBtn) {
          el.querySelector('.beat-label').insertAdjacentHTML('beforeend',
            `<button type="button" class="beat-remove" aria-label="Remove beat">×</button>`);
        }
      });
    }

    function renumberTagsIn(beatEl) {
      [...beatEl.querySelectorAll('.tags-list .tag-row')].forEach((el, i) => {
        el.querySelector('label').innerHTML = `Tag ${i + 1} <span class="label-hint" style="font-size:0.7rem">— another punchline off the same setup</span>`;
      });
    }

    paintBeats();

    document.getElementById('btn-add-beat').addEventListener('click', () => {
      beatsContainer.insertAdjacentHTML('beforeend',
        beatHTML(beatsContainer.querySelectorAll('.beat').length + 1, { setup: '', punchlines: [''] }, true));
    });

    beatsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('beat-remove')) {
        e.target.closest('.beat').remove();
        renumberBeats();
        return;
      }
      if (e.target.closest('.btn-add-tag')) {
        const beatEl = e.target.closest('.beat');
        const tagsList = beatEl.querySelector('.tags-list');
        const nextIdx = tagsList.querySelectorAll('.tag-row').length + 1;
        tagsList.insertAdjacentHTML('beforeend', tagHTML(nextIdx));
        return;
      }
      if (e.target.classList.contains('tag-remove')) {
        const beatEl = e.target.closest('.beat');
        e.target.closest('.tag-row').remove();
        renumberTagsIn(beatEl);
        return;
      }
    });

    // ---- Editor filter chip bar ----
    const ecWrap = document.getElementById('editor-chipbar');
    const ecSelected = document.getElementById('editor-chipbar-selected');
    const ecTrigger = document.getElementById('editor-chipbar-trigger');
    const ecPop = document.getElementById('editor-chipbar-pop');
    const ecSearch = document.getElementById('editor-chipbar-search');
    const ecOpts = document.getElementById('editor-chipbar-opts');

    function renderEcSelected() {
      ecSelected.innerHTML = editorCats.map(f =>
        `<span class="selected-chip">${UI.esc(f)}<button type="button" data-remove="${UI.esc(f)}" aria-label="Remove">×</button></span>`
      ).join('');
    }
    function renderEcOpts() {
      const q = ecSearch.value.toLowerCase();
      const matches = CATEGORIES.filter(f => f.toLowerCase().includes(q));
      ecOpts.innerHTML = matches.length === 0
        ? `<div class="search-pop-empty">No filters match</div>`
        : matches.map(f => `
            <div class="opt ${editorCats.includes(f) ? 'selected' : ''}" data-v="${UI.esc(f)}">
              <span class="tick">✓</span>${UI.esc(f)}
            </div>
          `).join('');
    }
    renderEcSelected();

    ecTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      ecPop.classList.toggle('open');
      if (ecPop.classList.contains('open')) {
        ecSearch.value = '';
        renderEcOpts();
        ecSearch.focus();
      }
    });
    ecSearch.addEventListener('input', renderEcOpts);
    ecOpts.addEventListener('click', (e) => {
      const opt = e.target.closest('.opt');
      if (!opt) return;
      const v = opt.dataset.v;
      const idx = editorCats.indexOf(v);
      if (idx >= 0) editorCats.splice(idx, 1);
      else editorCats.push(v);
      renderEcOpts();
      renderEcSelected();
    });
    ecSelected.addEventListener('click', (e) => {
      const v = e.target.dataset?.remove;
      if (!v) return;
      const idx = editorCats.indexOf(v);
      if (idx >= 0) editorCats.splice(idx, 1);
      renderEcSelected();
      if (ecPop.classList.contains('open')) renderEcOpts();
    });
    document.addEventListener('click', function onDocClick(e) {
      if (!ecWrap.contains(e.target)) ecPop.classList.remove('open');
    });

    // ---- Set Assignment chip toggles ----
    document.getElementById('editor-set-chips').addEventListener('click', (e) => {
      const btn = e.target.closest('.set-chip');
      if (!btn) return;
      const val = btn.dataset.set;
      const idx = editorSets.indexOf(val);
      if (idx >= 0) editorSets.splice(idx, 1);
      else editorSets.push(val);
      btn.classList.toggle('active');
    });

    // ---- Form submit ----
    document.getElementById('joke-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await Jokes.save(raw, prefill?.captureId, { editorCats, editorSets });
    });

    if (!isNew) {
      document.getElementById('btn-delete').addEventListener('click', async () => {
        await Jokes.deleteJoke(joke.id);
      });
      document.getElementById('btn-copy').addEventListener('click', async () => {
        await Jokes.copyToClipboard(joke);
      });
      document.getElementById('btn-pin-editor').addEventListener('click', async () => {
        // Mutate stored record directly
        const stored = await DB.get('jokes', joke.id);
        if (!stored) return;
        stored.pinned = !stored.pinned;
        await DB.put('jokes', stored);
        const btn = document.getElementById('btn-pin-editor');
        btn.classList.toggle('pin-active', stored.pinned);
        btn.querySelector('svg').setAttribute('fill', stored.pinned ? 'currentColor' : 'none');
        UI.toast(stored.pinned ? 'Pinned' : 'Unpinned');
      });

      const perfContainer = document.getElementById('perf-container');
      if (perfContainer) {
        perfContainer.innerHTML = await Performances.renderSection(joke.id);
        Performances.bindEvents(joke.id);
      }
    }
  },

  /** Copy joke text to clipboard */
  async copyToClipboard(joke) {
    const n = normalizeJoke(joke);
    const parts = [];
    if (n.premise) parts.push(`Premise: ${n.premise}`);
    n.beats.forEach((b, i) => {
      const label = n.beats.length > 1 ? ` (Beat ${i + 1})` : '';
      if (b.setup) parts.push(`Setup${label}: ${b.setup}`);
      (b.punchlines || []).forEach((p, pi) => {
        if (!p) return;
        const pLabel = pi === 0 ? 'Punchline' : `Tag ${pi}`;
        parts.push(`${pLabel}${label}: ${p}`);
      });
    });
    const text = parts.join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      UI.toast('Copied to clipboard');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      UI.toast('Copied to clipboard');
    }
  },

  /** Save a joke (create or update). captureId set when converting a capture. */
  async save(existing, captureId, extras = {}) {
    const method = document.getElementById('method').value;
    const premise = document.getElementById('premise').value.trim();
    const pipelineStage = document.getElementById('pipeline-stage').value;
    const labelsRaw = document.getElementById('labels').value;
    const labels = labelsRaw ? labelsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    const categories = extras.editorCats ? [...extras.editorCats] : [];
    const setAssignments = extras.editorSets ? [...extras.editorSets] : [];

    // Keep legacy status in sync for older code paths / exports
    const legacyStatus =
      pipelineStage === 'retired' ? 'retired' :
      pipelineStage === 'rotation' || pipelineStage === 'tight' ? 'polished' :
      'draft';

    // Collect beats from the DOM
    const beatEls = [...document.querySelectorAll('#beats-container .beat')];
    const beats = beatEls.map(el => {
      const setup = (el.querySelector('.beat-setup')?.value || '').trim();
      const mainPunchline = (el.querySelector('.beat-punchline')?.value || '').trim();
      const tagPunchlines = [...el.querySelectorAll('.beat-tag')]
        .map(t => (t.value || '').trim())
        .filter(Boolean);
      const punchlines = [mainPunchline, ...tagPunchlines].filter((p, i) => i === 0 || p); // keep first slot even if empty
      return { setup, punchlines: punchlines.length > 0 ? punchlines : [''] };
    });

    // Validation — require at least one non-empty field somewhere
    const hasContent = premise
      || beats.some(b => b.setup || b.punchlines.some(p => p));
    if (!hasContent) {
      UI.toast('Write at least one field');
      return;
    }

    const now = new Date().toISOString();
    const joke = {
      id: existing ? existing.id : DB.uid(),
      method,
      premise,
      beats,
      categories,
      setAssignments,
      pipelineStage,
      status: legacyStatus, // kept in sync for older code paths
      labels,
      pinned: existing ? existing.pinned || false : false,
      bitId: existing ? existing.bitId || null : null,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    await DB.put('jokes', joke);

    if (captureId && !existing) {
      await Captures.markConverted(captureId, joke.id);
    }

    UI.toast(existing ? 'Joke updated' : 'Joke saved');
    window.location.hash = '#/jokes';
  },

  /** Delete a joke with confirmation */
  async deleteJoke(id) {
    const confirmed = await UI.confirm(
      'Delete joke?',
      'This will permanently remove this joke. This can\'t be undone.'
    );
    if (!confirmed) return;

    await DB.delete('jokes', id);
    UI.toast('Joke deleted');
    window.location.hash = '#/jokes';
  },

  /** Get a random joke */
  async getRandomJoke() {
    const jokes = await DB.getAll('jokes');
    if (jokes.length === 0) return null;
    return jokes[Math.floor(Math.random() * jokes.length)];
  }
};

export default Jokes;
export { CATEGORIES, METHODS, normalizeJoke, firstSetup, firstPunchline };
