/**
 * app.js — Router, navigation, and app initialization
 */

import Jokes from './jokes.js';
import Captures from './captures.js';

const routes = {
  '/jokes': () => Jokes.renderList(),
  '/editor': (id) => {
    // Check if we're converting a capture
    const pending = Captures.consumePendingConvert();
    if (pending) {
      Jokes.renderEditor(null, { premise: pending.text, captureId: pending.id });
    } else {
      Jokes.renderEditor(id);
    }
  },
  '/captures': () => Captures.renderList(),
};

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

  // Update active tab
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.route === route);
  });

  // Show/hide FAB (only on list views, not editor)
  const fab = document.getElementById('fab');
  if (fab) {
    const showFab = route === '/jokes';
    fab.style.display = showFab ? 'flex' : 'none';
  }
}

function initApp() {
  // Listen for navigation
  window.addEventListener('hashchange', navigate);

  // FAB click — new joke
  document.getElementById('fab').addEventListener('click', () => {
    window.location.hash = '#/editor';
  });

  // Bottom nav clicks
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const route = tab.dataset.route;
      if (route && !tab.classList.contains('disabled')) {
        window.location.hash = '#' + route;
      }
    });
  });

  // Initial route
  if (!window.location.hash) {
    window.location.hash = '#/jokes';
  } else {
    navigate();
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
