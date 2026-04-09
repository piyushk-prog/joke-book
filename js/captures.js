/**
 * captures.js — Quick Capture: jot raw observations, convert to jokes later
 */

import DB from './db.js';
import UI from './ui.js';

const Captures = {
  /** Render the captures list view */
  async renderList() {
    const captures = await DB.getAll('captures');
    captures.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Split into active and converted
    const active = captures.filter(c => !c.convertedToJokeId);
    const converted = captures.filter(c => c.convertedToJokeId);

    const app = document.getElementById('app-content');

    app.innerHTML = `
      <div class="view-header">
        <h1>Captures</h1>
        <span class="joke-count">${active.length} idea${active.length !== 1 ? 's' : ''}</span>
      </div>

      <form id="capture-form" class="capture-form">
        <div class="capture-input-row">
          <input type="text" id="capture-text" placeholder="Jot a funny thought..." autocomplete="off">
          <button type="submit" class="btn btn-primary btn-capture-add" aria-label="Add">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </form>

      ${active.length === 0 && converted.length === 0 ? UI.emptyState(
        '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
        'No captures yet',
        'Type a quick thought above — refine it into a joke later'
      ) : ''}

      ${active.length > 0 ? `
        <div class="capture-list">
          ${active.map(c => Captures.renderCard(c)).join('')}
        </div>
      ` : (converted.length > 0 ? `
        <p class="section-hint">All captures have been converted to jokes!</p>
      ` : '')}

      ${converted.length > 0 ? `
        <details class="converted-section">
          <summary class="converted-header">Converted (${converted.length})</summary>
          <div class="capture-list capture-list-converted">
            ${converted.map(c => Captures.renderCard(c, true)).join('')}
          </div>
        </details>
      ` : ''}
    `;

    Captures.bindEvents();
  },

  /** Render a single capture card */
  renderCard(capture, isConverted = false) {
    return `
      <div class="capture-card ${isConverted ? 'capture-converted' : ''}" data-id="${capture.id}">
        <div class="capture-text">${UI.esc(capture.text)}</div>
        <div class="capture-meta">
          <span class="capture-date">${UI.formatDate(capture.createdAt)}</span>
          <div class="capture-actions">
            ${!isConverted ? `
              <button class="btn-sm btn-convert" data-id="${capture.id}" title="Convert to joke">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
                Joke
              </button>
            ` : `
              <span class="capture-converted-label">Converted</span>
            `}
            <button class="btn-sm btn-capture-delete" data-id="${capture.id}" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  /** Bind events for capture form and actions */
  bindEvents() {
    // Add capture form
    document.getElementById('capture-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('capture-text');
      const text = input.value.trim();
      if (!text) return;

      await DB.put('captures', {
        id: DB.uid(),
        text,
        createdAt: new Date().toISOString(),
        convertedToJokeId: null,
      });

      input.value = '';
      UI.toast('Captured!');
      Captures.renderList();
    });

    // Convert to joke buttons
    document.querySelectorAll('.btn-convert').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        await Captures.convertToJoke(id);
      });
    });

    // Delete buttons
    document.querySelectorAll('.btn-capture-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        await Captures.deleteCapture(id);
      });
    });
  },

  /** Convert a capture into a new joke */
  async convertToJoke(captureId) {
    const capture = await DB.get('captures', captureId);
    if (!capture) return;

    // Store the capture text for the editor, then navigate
    Captures._pendingConvert = capture;
    window.location.hash = '#/editor';
  },

  /** Get and clear pending capture conversion */
  consumePendingConvert() {
    const pending = Captures._pendingConvert;
    Captures._pendingConvert = null;
    return pending;
  },

  /** Mark a capture as converted after joke is saved */
  async markConverted(captureId, jokeId) {
    const capture = await DB.get('captures', captureId);
    if (capture) {
      capture.convertedToJokeId = jokeId;
      await DB.put('captures', capture);
    }
  },

  /** Delete a capture */
  async deleteCapture(id) {
    const confirmed = await UI.confirm('Delete capture?', 'This idea will be gone forever.');
    if (!confirmed) return;

    await DB.delete('captures', id);
    UI.toast('Capture deleted');
    Captures.renderList();
  }
};

export default Captures;
