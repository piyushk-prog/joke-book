/**
 * performances.js — Track how jokes land at gigs
 */

import DB from './db.js';
import UI from './ui.js';

const RATINGS = [
  { value: 1, label: 'Bombed', color: '#E17055' },
  { value: 2, label: 'Meh', color: '#FDCB6E' },
  { value: 3, label: 'OK', color: '#74B9FF' },
  { value: 4, label: 'Good', color: '#55EFC4' },
  { value: 5, label: 'Killed', color: '#00B894' },
];

const Performances = {
  /** Get all performances for a joke */
  async getForJoke(jokeId) {
    return DB.getAllByIndex('performances', 'jokeId', jokeId);
  },

  /** Get average rating for a joke */
  async getStats(jokeId) {
    const perfs = await Performances.getForJoke(jokeId);
    if (perfs.length === 0) return null;
    const avg = perfs.reduce((sum, p) => sum + p.rating, 0) / perfs.length;
    return { count: perfs.length, avg: Math.round(avg * 10) / 10 };
  },

  /** Render the performance log section inside joke editor */
  async renderSection(jokeId) {
    const perfs = await Performances.getForJoke(jokeId);
    perfs.sort((a, b) => new Date(b.date) - new Date(a.date));

    return `
      <div class="perf-section">
        <div class="perf-section-header">
          <h3>Performance Log</h3>
          <button class="btn-sm btn-convert" id="btn-add-perf">+ Log</button>
        </div>

        ${perfs.length === 0 ? `
          <p class="section-hint">No performances logged yet</p>
        ` : `
          <div class="perf-list">
            ${perfs.map(p => `
              <div class="perf-item" data-id="${p.id}">
                <div class="perf-rating-badge" style="background:${RATINGS[p.rating - 1]?.color || '#999'}">${RATINGS[p.rating - 1]?.label || p.rating}</div>
                <div class="perf-details">
                  ${p.venue ? `<span class="perf-venue">${UI.esc(p.venue)}</span>` : ''}
                  <span class="perf-date">${p.date ? UI.formatDate(p.date) : ''}</span>
                </div>
                ${p.audienceNotes ? `<div class="perf-notes">${UI.esc(p.audienceNotes)}</div>` : ''}
                <button class="btn-icon-sm btn-delete-sm perf-delete" data-perf-id="${p.id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  },

  /** Bind events for performance section */
  bindEvents(jokeId) {
    document.getElementById('btn-add-perf')?.addEventListener('click', () => {
      Performances.showAddModal(jokeId);
    });

    document.querySelectorAll('.perf-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await UI.confirm('Delete performance?', 'This log entry will be removed.');
        if (!ok) return;
        await DB.delete('performances', btn.dataset.perfId);
        UI.toast('Performance deleted');
        // Re-render the section
        const container = document.querySelector('.perf-section');
        if (container) {
          container.outerHTML = await Performances.renderSection(jokeId);
          Performances.bindEvents(jokeId);
        }
      });
    });
  },

  /** Show modal to add a performance */
  showAddModal(jokeId) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3 class="modal-title">Log Performance</h3>
        <form id="perf-form" class="joke-form" style="gap:12px">
          <div class="form-group">
            <label>How did it land?</label>
            <div class="rating-picker">
              ${RATINGS.map(r => `
                <button type="button" class="rating-btn" data-rating="${r.value}" style="--rating-color:${r.color}">
                  ${r.label}
                </button>
              `).join('')}
            </div>
            <input type="hidden" id="perf-rating" value="">
          </div>
          <div class="form-row">
            <div class="form-group form-group-half">
              <label for="perf-date">Date</label>
              <input type="date" id="perf-date" value="${new Date().toISOString().slice(0, 10)}">
            </div>
            <div class="form-group form-group-half">
              <label for="perf-venue">Venue</label>
              <input type="text" id="perf-venue" placeholder="Where?">
            </div>
          </div>
          <div class="form-group">
            <label for="perf-notes">Audience notes</label>
            <textarea id="perf-notes" rows="2" placeholder="How did the crowd react?"></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    `;

    // Rating picker
    let selectedRating = 0;
    overlay.querySelectorAll('.rating-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedRating = parseInt(btn.dataset.rating);
        overlay.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    overlay.querySelector('[data-action="cancel"]').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.querySelector('#perf-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedRating) { UI.toast('Pick a rating'); return; }

      await DB.put('performances', {
        id: DB.uid(),
        jokeId,
        rating: selectedRating,
        date: overlay.querySelector('#perf-date').value || new Date().toISOString(),
        venue: overlay.querySelector('#perf-venue').value.trim(),
        audienceNotes: overlay.querySelector('#perf-notes').value.trim(),
      });

      overlay.remove();
      UI.toast('Performance logged');

      // Re-render perf section
      const container = document.querySelector('.perf-section');
      if (container) {
        container.outerHTML = await Performances.renderSection(jokeId);
        Performances.bindEvents(jokeId);
      }
    });

    document.body.appendChild(overlay);
  },

  /** Render a small stats line for joke cards */
  renderStatsInline(stats) {
    if (!stats) return '';
    const ratingObj = RATINGS[Math.round(stats.avg) - 1] || RATINGS[2];
    return `<span class="perf-inline" style="color:${ratingObj.color}">${stats.avg} avg &middot; ${stats.count}x</span>`;
  }
};

export default Performances;
export { RATINGS };
