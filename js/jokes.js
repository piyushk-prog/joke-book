/**
 * jokes.js — Joke CRUD, search, filtering, sorting, favorites, copy
 */

import DB from './db.js';
import UI from './ui.js';
import Captures from './captures.js';
import Performances from './performances.js';

const CATEGORIES = [
  'One-liner', 'Observational', 'Wordplay', 'Dark', 'Topical',
  'Self-deprecating', 'Absurd', 'Storytelling', 'Crowd work', 'Other'
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'best', label: 'Best rated' },
  { value: 'most-performed', label: 'Most performed' },
];

// Current filter/sort state (persists while app is open)
let currentFilters = {
  query: '',
  status: 'all',
  category: 'all',
  sort: 'newest',
};

// Cache perf stats to avoid re-fetching during sort
let perfStatsCache = {};

function matchesSearch(joke, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    (joke.premise || '').toLowerCase().includes(q) ||
    (joke.setup || '').toLowerCase().includes(q) ||
    (joke.punchline || '').toLowerCase().includes(q) ||
    (joke.tags || []).some(t => t.toLowerCase().includes(q))
  );
}

function applyFilters(jokes) {
  return jokes.filter(joke => {
    if (!matchesSearch(joke, currentFilters.query)) return false;
    if (currentFilters.status !== 'all' && joke.status !== currentFilters.status) return false;
    if (currentFilters.category !== 'all' && joke.category !== currentFilters.category) return false;
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

const Jokes = {
  /** Render the joke list view */
  async renderList() {
    const allJokes = await DB.getAll('jokes');

    // Pre-fetch all perf stats for sorting
    perfStatsCache = {};
    await Promise.all(allJokes.map(async (joke) => {
      perfStatsCache[joke.id] = await Performances.getStats(joke.id);
    }));

    const filtered = applyFilters(allJokes);
    const sorted = applySortAndPin(filtered);
    const app = document.getElementById('app-content');

    const usedCategories = [...new Set(allJokes.map(j => j.category).filter(Boolean))];
    const hasFilters = currentFilters.query || currentFilters.status !== 'all' || currentFilters.category !== 'all';

    const sortOptions = SORT_OPTIONS.map(s =>
      `<option value="${s.value}" ${currentFilters.sort === s.value ? 'selected' : ''}>${s.label}</option>`
    ).join('');

    app.innerHTML = `
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
          <div class="filter-chips" id="status-filters">
            <button class="filter-chip ${currentFilters.status === 'all' ? 'active' : ''}" data-status="all">All</button>
            <button class="filter-chip ${currentFilters.status === 'draft' ? 'active' : ''}" data-status="draft">Draft</button>
            <button class="filter-chip ${currentFilters.status === 'polished' ? 'active' : ''}" data-status="polished">Polished</button>
            <button class="filter-chip ${currentFilters.status === 'retired' ? 'active' : ''}" data-status="retired">Retired</button>
          </div>
          <div class="filter-dropdowns">
            ${usedCategories.length > 0 ? `
              <select class="filter-select" id="category-filter">
                <option value="all" ${currentFilters.category === 'all' ? 'selected' : ''}>All categories</option>
                ${usedCategories.map(c => `<option value="${c}" ${currentFilters.category === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            ` : ''}
            <select class="filter-select" id="sort-select">
              ${sortOptions}
            </select>
          </div>
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
    return `
      <div class="joke-card" data-id="${joke.id}">
        <div class="joke-card-header">
          <button class="btn-pin ${joke.pinned ? 'pinned' : ''}" data-pin-id="${joke.id}" aria-label="Pin" onclick="event.stopPropagation()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${joke.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </button>
          ${UI.statusBadge(joke.status || 'draft')}
          ${UI.categoryBadge(joke.category)}
          ${Performances.renderStatsInline(stats)}
          <span class="joke-date">${UI.formatDate(joke.updatedAt)}</span>
        </div>
        <div class="joke-card-body" onclick="window.location.hash='#/editor/${joke.id}'">
          ${joke.premise ? `<div class="joke-preview-line"><span class="label-mini">P</span> ${UI.esc(UI.truncate(joke.premise, 60))}</div>` : ''}
          ${joke.setup ? `<div class="joke-preview-line"><span class="label-mini">S</span> ${UI.esc(UI.truncate(joke.setup, 60))}</div>` : ''}
          ${joke.punchline ? `<div class="joke-preview-line"><span class="label-mini">PL</span> ${UI.esc(UI.truncate(joke.punchline, 60))}</div>` : ''}
        </div>
        ${joke.tags && joke.tags.length > 0 ? `<div class="joke-card-tags" onclick="window.location.hash='#/editor/${joke.id}'">${UI.tagChips(joke.tags)}</div>` : ''}
      </div>
    `;
  },

  /** Bind events for search, filters, sort, and pin */
  bindListEvents() {
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

    document.querySelectorAll('#status-filters .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        currentFilters.status = chip.dataset.status;
        Jokes.renderList();
      });
    });

    const catFilter = document.getElementById('category-filter');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        currentFilters.category = e.target.value;
        Jokes.renderList();
      });
    }

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
    let joke = null;
    if (jokeId) {
      joke = await DB.get('jokes', jokeId);
      if (!joke) {
        UI.toast('Joke not found');
        window.location.hash = '#/jokes';
        return;
      }
    }

    const isNew = !joke;
    const app = document.getElementById('app-content');

    const categoryOptions = CATEGORIES.map(c =>
      `<option value="${c}" ${joke && joke.category === c ? 'selected' : ''}>${c}</option>`
    ).join('');

    const premiseVal = prefill?.premise || (joke ? joke.premise : '');
    const setupVal = joke ? joke.setup : '';
    const punchlineVal = joke ? joke.punchline : '';

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
          <label for="premise">Premise</label>
          <textarea id="premise" placeholder="The observation or truth behind the joke..." rows="3">${UI.esc(premiseVal)}</textarea>
        </div>

        <div class="form-group">
          <label for="setup">Setup</label>
          <textarea id="setup" placeholder="How you lead the audience in..." rows="3">${UI.esc(setupVal)}</textarea>
        </div>

        <div class="form-group">
          <label for="punchline">Punchline</label>
          <textarea id="punchline" placeholder="The twist, the payoff..." rows="3">${UI.esc(punchlineVal)}</textarea>
        </div>

        <div class="form-row">
          <div class="form-group form-group-half">
            <label for="category">Category</label>
            <select id="category">
              <option value="">Choose...</option>
              ${categoryOptions}
            </select>
          </div>
          <div class="form-group form-group-half">
            <label for="status">Status</label>
            <select id="status">
              <option value="draft" ${joke && joke.status === 'draft' ? 'selected' : ''}>Draft</option>
              <option value="polished" ${joke && joke.status === 'polished' ? 'selected' : ''}>Polished</option>
              <option value="retired" ${joke && joke.status === 'retired' ? 'selected' : ''}>Retired</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="tags">Tags <span class="label-hint">comma-separated</span></label>
          <input type="text" id="tags" placeholder="e.g. relationships, work, food" value="${joke && joke.tags ? UI.esc(joke.tags.join(', ')) : ''}">
        </div>

        <button type="submit" class="btn btn-primary btn-full">
          ${isNew ? 'Save Joke' : 'Update Joke'}
        </button>
      </form>

      ${!isNew ? `<div id="perf-container"></div>` : ''}
    `;

    // Bind form submit
    document.getElementById('joke-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await Jokes.save(joke, prefill?.captureId);
    });

    if (!isNew) {
      // Delete
      document.getElementById('btn-delete').addEventListener('click', async () => {
        await Jokes.deleteJoke(joke.id);
      });

      // Copy to clipboard
      document.getElementById('btn-copy').addEventListener('click', async () => {
        await Jokes.copyToClipboard(joke);
      });

      // Pin toggle in editor
      document.getElementById('btn-pin-editor').addEventListener('click', async () => {
        joke.pinned = !joke.pinned;
        await DB.put('jokes', joke);
        const btn = document.getElementById('btn-pin-editor');
        btn.classList.toggle('pin-active', joke.pinned);
        btn.querySelector('svg').setAttribute('fill', joke.pinned ? 'currentColor' : 'none');
        UI.toast(joke.pinned ? 'Pinned' : 'Unpinned');
      });

      // Performance section
      const perfContainer = document.getElementById('perf-container');
      if (perfContainer) {
        perfContainer.innerHTML = await Performances.renderSection(joke.id);
        Performances.bindEvents(joke.id);
      }
    }
  },

  /** Copy joke text to clipboard */
  async copyToClipboard(joke) {
    const parts = [];
    if (joke.premise) parts.push(`Premise: ${joke.premise}`);
    if (joke.setup) parts.push(`Setup: ${joke.setup}`);
    if (joke.punchline) parts.push(`Punchline: ${joke.punchline}`);
    const text = parts.join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      UI.toast('Copied to clipboard');
    } catch {
      // Fallback for older browsers
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
  async save(existing, captureId) {
    const premise = document.getElementById('premise').value.trim();
    const setup = document.getElementById('setup').value.trim();
    const punchline = document.getElementById('punchline').value.trim();
    const category = document.getElementById('category').value;
    const status = document.getElementById('status').value;
    const tagsRaw = document.getElementById('tags').value;
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

    if (!premise && !setup && !punchline) {
      UI.toast('Write at least one field');
      return;
    }

    const now = new Date().toISOString();
    const joke = {
      id: existing ? existing.id : DB.uid(),
      premise,
      setup,
      punchline,
      category,
      status,
      tags,
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
export { CATEGORIES };
