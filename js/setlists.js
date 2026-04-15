/**
 * setlists.js — Set Lists: group jokes into ordered sets for gigs
 */

import DB from './db.js';
import UI from './ui.js';
import { normalizeJoke, firstSetup, firstPunchline } from './jokes.js';

const SetLists = {
  /** Render all set lists */
  async renderList() {
    const sets = await DB.getAll('setlists');
    sets.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    const app = document.getElementById('app-content');

    app.innerHTML = `
      <div class="view-header">
        <h1>Set Lists</h1>
        <button class="btn btn-primary btn-sm-header" id="new-setlist">+ New Set</button>
      </div>

      ${sets.length === 0 ? UI.emptyState(
        '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
        'No set lists yet',
        'Create a set list to organize jokes for a gig'
      ) : `
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
    `;

    document.getElementById('new-setlist')?.addEventListener('click', () => {
      window.location.hash = '#/setedit';
    });
  },

  /** Render set list editor (create/edit) */
  async renderEditor(setId) {
    let set = null;
    if (setId) {
      set = await DB.get('setlists', setId);
      if (!set) { UI.toast('Set not found'); window.location.hash = '#/sets'; return; }
    }

    const isNew = !set;
    const app = document.getElementById('app-content');

    app.innerHTML = `
      <div class="editor-header">
        <button class="btn-icon" onclick="window.location.hash='${isNew ? '#/sets' : '#/setdetail/' + setId}'" aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <h2>${isNew ? 'New Set List' : 'Edit Set List'}</h2>
        <div class="editor-actions">
          ${!isNew ? `<button class="btn-icon btn-delete" id="btn-delete-set" aria-label="Delete">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>
          </button>` : ''}
        </div>
      </div>

      <form id="set-form" class="joke-form">
        <div class="form-group">
          <label for="set-name">Name</label>
          <input type="text" id="set-name" placeholder="e.g. Open Mic April" value="${set ? UI.esc(set.name) : ''}">
        </div>
        <div class="form-row">
          <div class="form-group form-group-half">
            <label for="set-date">Date</label>
            <input type="date" id="set-date" value="${set?.date ? set.date.slice(0, 10) : ''}">
          </div>
          <div class="form-group form-group-half">
            <label for="set-venue">Venue</label>
            <input type="text" id="set-venue" placeholder="e.g. Blue Frog" value="${set ? UI.esc(set.venue || '') : ''}">
          </div>
        </div>
        <div class="form-group">
          <label for="set-notes">Notes</label>
          <textarea id="set-notes" rows="2" placeholder="Any notes about this set...">${set ? UI.esc(set.notes || '') : ''}</textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-full">${isNew ? 'Create Set List' : 'Save Changes'}</button>
      </form>
    `;

    document.getElementById('set-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('set-name').value.trim();
      if (!name) { UI.toast('Give your set a name'); return; }

      const now = new Date().toISOString();
      const data = {
        id: set ? set.id : DB.uid(),
        name,
        date: document.getElementById('set-date').value || null,
        venue: document.getElementById('set-venue').value.trim(),
        notes: document.getElementById('set-notes').value.trim(),
        jokeIds: set ? set.jokeIds : [],
        createdAt: set ? set.createdAt : now,
      };
      await DB.put('setlists', data);
      UI.toast(isNew ? 'Set list created' : 'Set list updated');
      window.location.hash = '#/setdetail/' + data.id;
    });

    document.getElementById('btn-delete-set')?.addEventListener('click', async () => {
      const ok = await UI.confirm('Delete set list?', 'This will remove the set list (jokes themselves are kept).');
      if (!ok) return;
      await DB.delete('setlists', setId);
      UI.toast('Set list deleted');
      window.location.hash = '#/sets';
    });
  },

  /** Render set list detail (with jokes, reorder, add) */
  async renderDetail(setId) {
    const set = await DB.get('setlists', setId);
    if (!set) { UI.toast('Set not found'); window.location.hash = '#/sets'; return; }

    const jokes = [];
    for (const jid of (set.jokeIds || [])) {
      const j = await DB.get('jokes', jid);
      if (j) jokes.push(normalizeJoke(j));
    }

    const app = document.getElementById('app-content');

    app.innerHTML = `
      <div class="editor-header">
        <button class="btn-icon" onclick="window.location.hash='#/sets'" aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <h2>${UI.esc(set.name)}</h2>
        <div class="editor-actions">
          <button class="btn-icon" id="btn-edit-set" aria-label="Edit set">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
      </div>

      ${set.venue || set.date ? `
        <div class="set-meta-bar">
          ${set.date ? `<span>${new Date(set.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>` : ''}
          ${set.venue ? `<span>${UI.esc(set.venue)}</span>` : ''}
        </div>
      ` : ''}

      ${jokes.length === 0 ? `
        <div class="empty-state" style="padding:30px 20px">
          <h3>No jokes in this set</h3>
          <p>Add jokes to build your lineup</p>
        </div>
      ` : `
        <div class="set-jokes-list">
          ${jokes.map((joke, i) => `
            <div class="set-joke-item">
              <span class="set-joke-num">${i + 1}</span>
              <div class="set-joke-content" onclick="window.location.hash='#/editor/${joke.id}'">
                <div class="set-joke-premise">${UI.esc(UI.truncate(joke.premise || firstSetup(joke) || firstPunchline(joke), 50))}</div>
                ${(joke.categories || []).slice(0, 2).map(c => `<span class="badge badge-category" style="font-size:0.6rem">${UI.esc(c)}</span>`).join('')}${(joke.categories || []).length > 2 ? `<span class="badge badge-category" style="font-size:0.6rem">+${joke.categories.length - 2}</span>` : ''}
              </div>
              <div class="set-joke-controls">
                ${i > 0 ? `<button class="btn-icon-sm" data-action="up" data-idx="${i}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg></button>` : '<span class="btn-icon-sm-spacer"></span>'}
                ${i < jokes.length - 1 ? `<button class="btn-icon-sm" data-action="down" data-idx="${i}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></button>` : '<span class="btn-icon-sm-spacer"></span>'}
                <button class="btn-icon-sm btn-delete-sm" data-action="remove" data-idx="${i}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            </div>
          `).join('')}
        </div>
      `}

      <button class="btn btn-secondary btn-full" id="btn-add-joke" style="margin-top:16px">+ Add Joke</button>

      ${set.notes ? `<div class="set-notes"><strong>Notes:</strong> ${UI.esc(set.notes)}</div>` : ''}
    `;

    // Edit set
    document.getElementById('btn-edit-set').addEventListener('click', () => {
      window.location.hash = '#/setedit/' + setId;
    });

    // Add joke picker
    document.getElementById('btn-add-joke').addEventListener('click', () => {
      SetLists.showJokePicker(set);
    });

    // Reorder / remove controls
    document.querySelectorAll('.set-joke-controls button').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const idx = parseInt(btn.dataset.idx);
        if (action === 'up' && idx > 0) {
          [set.jokeIds[idx], set.jokeIds[idx - 1]] = [set.jokeIds[idx - 1], set.jokeIds[idx]];
        } else if (action === 'down' && idx < set.jokeIds.length - 1) {
          [set.jokeIds[idx], set.jokeIds[idx + 1]] = [set.jokeIds[idx + 1], set.jokeIds[idx]];
        } else if (action === 'remove') {
          set.jokeIds.splice(idx, 1);
        }
        await DB.put('setlists', set);
        SetLists.renderDetail(setId);
      });
    });
  },

  /** Show a joke picker modal to add jokes to a set */
  async showJokePicker(set) {
    const rawJokes = await DB.getAll('jokes');
    const allJokes = rawJokes.map(normalizeJoke);
    const existing = new Set(set.jokeIds || []);
    const available = allJokes.filter(j => !existing.has(j.id));

    if (available.length === 0) {
      UI.toast('All jokes are already in this set');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal-tall">
        <h3 class="modal-title">Add Jokes</h3>
        <div class="picker-list">
          ${available.map(j => `
            <label class="picker-item">
              <input type="checkbox" value="${j.id}">
              <span>${UI.esc(UI.truncate(j.premise || firstSetup(j) || firstPunchline(j), 45))}</span>
            </label>
          `).join('')}
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-action="cancel">Cancel</button>
          <button class="btn btn-primary" data-action="add">Add Selected</button>
        </div>
      </div>
    `;

    overlay.querySelector('[data-action="cancel"]').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.querySelector('[data-action="add"]').onclick = async () => {
      const checked = overlay.querySelectorAll('input[type="checkbox"]:checked');
      const newIds = Array.from(checked).map(cb => cb.value);
      if (newIds.length === 0) { UI.toast('Select at least one joke'); return; }

      set.jokeIds = [...(set.jokeIds || []), ...newIds];
      await DB.put('setlists', set);
      overlay.remove();
      UI.toast(`Added ${newIds.length} joke${newIds.length > 1 ? 's' : ''}`);
      SetLists.renderDetail(set.id);
    };

    document.body.appendChild(overlay);
  }
};

export default SetLists;
