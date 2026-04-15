/**
 * bits.js — Bit Builder: connect related jokes into longer routines
 */

import DB from './db.js';
import UI from './ui.js';
import { normalizeJoke, firstSetup, firstPunchline } from './jokes.js';

const Bits = {
  /** Render all bits */
  async renderList() {
    const bits = await DB.getAll('bits');
    bits.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const app = document.getElementById('app-content');

    app.innerHTML = `
      <div class="view-header">
        <h1>Bits</h1>
        <button class="btn btn-primary btn-sm-header" id="new-bit">+ New Bit</button>
      </div>
      <p class="section-hint" style="margin-bottom:16px">A "bit" connects related jokes into a longer routine on one topic.</p>

      ${bits.length === 0 ? UI.emptyState(
        '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>',
        'No bits yet',
        'Link related jokes into a routine'
      ) : `
        <div class="setlist-list">
          ${bits.map(b => `
            <div class="setlist-card" onclick="window.location.hash='#/bitdetail/${b.id}'">
              <div class="setlist-card-title">${UI.esc(b.name)}</div>
              <div class="setlist-card-meta">${b.jokeIds ? b.jokeIds.length : 0} joke${(b.jokeIds?.length || 0) !== 1 ? 's' : ''}</div>
            </div>
          `).join('')}
        </div>
      `}
    `;

    document.getElementById('new-bit')?.addEventListener('click', () => {
      window.location.hash = '#/bitedit';
    });
  },

  /** Render bit editor (create/edit) */
  async renderEditor(bitId) {
    let bit = null;
    if (bitId) {
      bit = await DB.get('bits', bitId);
      if (!bit) { UI.toast('Bit not found'); window.location.hash = '#/sets'; return; }
    }

    const isNew = !bit;
    const app = document.getElementById('app-content');

    app.innerHTML = `
      <div class="editor-header">
        <button class="btn-icon" onclick="window.location.hash='${isNew ? '#/sets' : '#/bitdetail/' + bitId}'" aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <h2>${isNew ? 'New Bit' : 'Edit Bit'}</h2>
        <div class="editor-actions">
          ${!isNew ? `<button class="btn-icon btn-delete" id="btn-delete-bit" aria-label="Delete">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>
          </button>` : ''}
        </div>
      </div>

      <form id="bit-form" class="joke-form">
        <div class="form-group">
          <label for="bit-name">Name</label>
          <input type="text" id="bit-name" placeholder="e.g. Dating Apps, Indian Parents" value="${bit ? UI.esc(bit.name) : ''}">
        </div>
        <div class="form-group">
          <label for="bit-notes">Notes</label>
          <textarea id="bit-notes" rows="2" placeholder="What ties these jokes together...">${bit ? UI.esc(bit.notes || '') : ''}</textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-full">${isNew ? 'Create Bit' : 'Save Changes'}</button>
      </form>
    `;

    document.getElementById('bit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('bit-name').value.trim();
      if (!name) { UI.toast('Give your bit a name'); return; }

      const data = {
        id: bit ? bit.id : DB.uid(),
        name,
        notes: document.getElementById('bit-notes').value.trim(),
        jokeIds: bit ? bit.jokeIds : [],
        createdAt: bit ? bit.createdAt : new Date().toISOString(),
      };
      await DB.put('bits', data);
      UI.toast(isNew ? 'Bit created' : 'Bit updated');
      window.location.hash = '#/bitdetail/' + data.id;
    });

    document.getElementById('btn-delete-bit')?.addEventListener('click', async () => {
      const ok = await UI.confirm('Delete bit?', 'This removes the bit grouping (jokes are kept).');
      if (!ok) return;
      await DB.delete('bits', bitId);
      UI.toast('Bit deleted');
      window.location.hash = '#/sets';
    });
  },

  /** Render bit detail (with jokes, reorder, add) */
  async renderDetail(bitId) {
    const bit = await DB.get('bits', bitId);
    if (!bit) { UI.toast('Bit not found'); window.location.hash = '#/sets'; return; }

    const jokes = [];
    for (const jid of (bit.jokeIds || [])) {
      const j = await DB.get('jokes', jid);
      if (j) jokes.push(normalizeJoke(j));
    }

    const app = document.getElementById('app-content');

    app.innerHTML = `
      <div class="editor-header">
        <button class="btn-icon" onclick="window.location.hash='#/sets'" aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <h2>${UI.esc(bit.name)}</h2>
        <div class="editor-actions">
          <button class="btn-icon" id="btn-edit-bit" aria-label="Edit bit">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
      </div>

      ${bit.notes ? `<p class="section-hint" style="margin-bottom:12px">${UI.esc(bit.notes)}</p>` : ''}

      ${jokes.length === 0 ? `
        <div class="empty-state" style="padding:30px 20px">
          <h3>No jokes linked</h3>
          <p>Add jokes to build this routine</p>
        </div>
      ` : `
        <div class="set-jokes-list">
          ${jokes.map((joke, i) => `
            <div class="set-joke-item">
              <span class="set-joke-num">${i + 1}</span>
              <div class="set-joke-content" onclick="window.location.hash='#/editor/${joke.id}'">
                <div class="set-joke-premise">${UI.esc(UI.truncate(joke.premise || firstSetup(joke) || firstPunchline(joke), 50))}</div>
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

      <button class="btn btn-secondary btn-full" id="btn-add-joke-bit" style="margin-top:16px">+ Add Joke</button>
    `;

    document.getElementById('btn-edit-bit').addEventListener('click', () => {
      window.location.hash = '#/bitedit/' + bitId;
    });

    document.getElementById('btn-add-joke-bit').addEventListener('click', () => {
      Bits.showJokePicker(bit);
    });

    document.querySelectorAll('.set-joke-controls button').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const idx = parseInt(btn.dataset.idx);
        if (action === 'up' && idx > 0) {
          [bit.jokeIds[idx], bit.jokeIds[idx - 1]] = [bit.jokeIds[idx - 1], bit.jokeIds[idx]];
        } else if (action === 'down' && idx < bit.jokeIds.length - 1) {
          [bit.jokeIds[idx], bit.jokeIds[idx + 1]] = [bit.jokeIds[idx + 1], bit.jokeIds[idx]];
        } else if (action === 'remove') {
          bit.jokeIds.splice(idx, 1);
        }
        await DB.put('bits', bit);
        Bits.renderDetail(bitId);
      });
    });
  },

  /** Show joke picker for adding to a bit */
  async showJokePicker(bit) {
    const rawJokes = await DB.getAll('jokes');
    const allJokes = rawJokes.map(normalizeJoke);
    const existing = new Set(bit.jokeIds || []);
    const available = allJokes.filter(j => !existing.has(j.id));

    if (available.length === 0) {
      UI.toast('All jokes are already in this bit');
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

      bit.jokeIds = [...(bit.jokeIds || []), ...newIds];
      await DB.put('bits', bit);
      overlay.remove();
      UI.toast(`Added ${newIds.length} joke${newIds.length > 1 ? 's' : ''}`);
      Bits.renderDetail(bit.id);
    };

    document.body.appendChild(overlay);
  }
};

export default Bits;
