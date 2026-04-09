/**
 * app.js — Router, navigation, and app initialization
 */

import Jokes from './jokes.js';
import Captures from './captures.js';
import SetLists from './setlists.js';
import Bits from './bits.js';
import More from './more.js';
import Timer from './timer.js';
import Stats from './stats.js';

const routes = {
  '/jokes': () => Jokes.renderList(),
  '/editor': (id) => {
    const pending = Captures.consumePendingConvert();
    if (pending) {
      Jokes.renderEditor(null, { premise: pending.text, captureId: pending.id });
    } else {
      Jokes.renderEditor(id);
    }
  },
  '/captures': () => Captures.renderList(),
  '/sets': () => renderSetsTab(),
  '/setdetail': (id) => SetLists.renderDetail(id),
  '/setedit': (id) => SetLists.renderEditor(id),
  '/bitdetail': (id) => Bits.renderDetail(id),
  '/bitedit': (id) => Bits.renderEditor(id),
  '/more': () => More.renderPage(),
  '/timer': () => Timer.renderTimer(),
  '/stats': () => Stats.renderPage(),
};

/** Combined Sets tab: set lists + bits */
async function renderSetsTab() {
  const sets = await (await import('./db.js')).default.getAll('setlists');
  const bits = await (await import('./db.js')).default.getAll('bits');
  const UI = (await import('./ui.js')).default;

  sets.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  bits.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const app = document.getElementById('app-content');

  app.innerHTML = `
    <div class="view-header">
      <h1>Sets & Bits</h1>
    </div>

    <div class="sets-section">
      <div class="sets-section-header">
        <h3>Set Lists</h3>
        <button class="btn btn-primary btn-sm-header" id="new-setlist">+ New Set</button>
      </div>
      ${sets.length === 0 ? `<p class="section-hint">No set lists yet — create one for your next gig</p>` : `
        <div class="setlist-list">
          ${sets.map(s => `
            <div class="setlist-card" onclick="window.location.hash='#/setdetail/${s.id}'">
              <div class="setlist-card-title">${UI.esc(s.name)}</div>
              <div class="setlist-card-meta">
                ${s.jokeIds ? s.jokeIds.length : 0} joke${(s.jokeIds?.length || 0) !== 1 ? 's' : ''}
                ${s.venue ? ' &middot; ' + UI.esc(s.venue) : ''}
                ${s.date ? ' &middot; ' + UI.formatDate(s.date) : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <div class="sets-section" style="margin-top:28px">
      <div class="sets-section-header">
        <h3>Bits</h3>
        <button class="btn btn-primary btn-sm-header" id="new-bit">+ New Bit</button>
      </div>
      <p class="section-hint" style="margin-bottom:8px">Link related jokes into longer routines</p>
      ${bits.length === 0 ? `<p class="section-hint">No bits yet</p>` : `
        <div class="setlist-list">
          ${bits.map(b => `
            <div class="setlist-card" onclick="window.location.hash='#/bitdetail/${b.id}'">
              <div class="setlist-card-title">${UI.esc(b.name)}</div>
              <div class="setlist-card-meta">${b.jokeIds ? b.jokeIds.length : 0} joke${(b.jokeIds?.length || 0) !== 1 ? 's' : ''}</div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

  document.getElementById('new-setlist')?.addEventListener('click', () => {
    window.location.hash = '#/setedit';
  });
  document.getElementById('new-bit')?.addEventListener('click', () => {
    window.location.hash = '#/bitedit';
  });
}

function parseHash() {
  const hash = window.location.hash.slice(1) || '/jokes';
  const parts = hash.split('/').filter(Boolean);
  const route = '/' + parts[0];
  const param = parts[1] || null;
  return { route, param };
}

function navigate() {
  const { route, param } = parseHash();
  const handler = routes[route];

  if (handler) {
    handler(param);
  } else {
    window.location.hash = '#/jokes';
  }

  // Map sub-routes to their parent tab
  const tabMap = {
    '/jokes': '/jokes', '/editor': '/jokes',
    '/captures': '/captures',
    '/sets': '/sets', '/setdetail': '/sets', '/setedit': '/sets',
    '/bitdetail': '/sets', '/bitedit': '/sets',
    '/more': '/more', '/timer': '/more', '/stats': '/more',
  };
  const activeTab = tabMap[route] || '/jokes';

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.route === activeTab);
  });

  // Show FAB only on joke list
  const fab = document.getElementById('fab');
  if (fab) {
    fab.style.display = (route === '/jokes') ? 'flex' : 'none';
  }
}

async function initApp() {
  // Apply saved theme before first render
  await More.applyTheme();

  window.addEventListener('hashchange', navigate);

  document.getElementById('fab').addEventListener('click', () => {
    window.location.hash = '#/editor';
  });

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const route = tab.dataset.route;
      if (route && !tab.classList.contains('disabled')) {
        window.location.hash = '#' + route;
      }
    });
  });

  if (!window.location.hash) {
    window.location.hash = '#/jokes';
  } else {
    navigate();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
