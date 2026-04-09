/**
 * stats.js — Stats dashboard: top jokes, popular tags, activity over time
 */

import DB from './db.js';
import UI from './ui.js';
import { RATINGS } from './performances.js';

const Stats = {
  async renderPage() {
    const jokes = await DB.getAll('jokes');
    const perfs = await DB.getAll('performances');
    const captures = await DB.getAll('captures');
    const sets = await DB.getAll('setlists');

    const app = document.getElementById('app-content');

    // --- Top jokes by average rating ---
    const jokePerfs = {};
    for (const p of perfs) {
      if (!jokePerfs[p.jokeId]) jokePerfs[p.jokeId] = [];
      jokePerfs[p.jokeId].push(p.rating);
    }

    const jokeStats = Object.entries(jokePerfs).map(([id, ratings]) => ({
      id,
      avg: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      count: ratings.length,
    })).sort((a, b) => b.avg - a.avg || b.count - a.count);

    const topJokes = [];
    for (const s of jokeStats.slice(0, 5)) {
      const j = await DB.get('jokes', s.id);
      if (j) topJokes.push({ ...s, joke: j });
    }

    // --- Most used tags ---
    const tagCounts = {};
    for (const j of jokes) {
      for (const t of (j.tags || [])) {
        const key = t.toLowerCase();
        tagCounts[key] = (tagCounts[key] || 0) + 1;
      }
    }
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // --- Jokes per month (last 6 months) ---
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7); // YYYY-MM
      const label = d.toLocaleDateString('en-IN', { month: 'short' });
      const count = jokes.filter(j => j.createdAt && j.createdAt.startsWith(key)).length;
      months.push({ label, count, key });
    }
    const maxMonth = Math.max(...months.map(m => m.count), 1);

    // --- Status breakdown ---
    const statusCounts = { draft: 0, polished: 0, retired: 0 };
    for (const j of jokes) {
      const s = j.status || 'draft';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }

    app.innerHTML = `
      <div class="editor-header">
        <button class="btn-icon" onclick="window.location.hash='#/more'" aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <h2>Stats</h2>
        <div></div>
      </div>

      <div class="stats-overview">
        <div class="stats-grid">
          <div class="stat-item"><span class="stat-num">${jokes.length}</span><span class="stat-label">Jokes</span></div>
          <div class="stat-item"><span class="stat-num">${perfs.length}</span><span class="stat-label">Performances</span></div>
          <div class="stat-item"><span class="stat-num">${captures.length}</span><span class="stat-label">Captures</span></div>
          <div class="stat-item"><span class="stat-num">${sets.length}</span><span class="stat-label">Set Lists</span></div>
        </div>
      </div>

      ${topJokes.length > 0 ? `
        <div class="stats-section">
          <h3 class="more-section-title">Top Jokes by Rating</h3>
          <div class="top-jokes-list">
            ${topJokes.map((t, i) => `
              <div class="top-joke-item" onclick="window.location.hash='#/editor/${t.id}'">
                <span class="top-joke-rank">#${i + 1}</span>
                <div class="top-joke-info">
                  <div class="top-joke-text">${UI.esc(UI.truncate(t.joke.premise || t.joke.setup || t.joke.punchline, 40))}</div>
                  <span class="top-joke-meta">${t.avg.toFixed(1)} avg &middot; ${t.count} show${t.count !== 1 ? 's' : ''}</span>
                </div>
                <span class="perf-rating-badge" style="background:${RATINGS[Math.round(t.avg) - 1]?.color || '#999'};font-size:0.65rem">${RATINGS[Math.round(t.avg) - 1]?.label || ''}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="stats-section">
        <h3 class="more-section-title">Jokes Created (Last 6 Months)</h3>
        <div class="bar-chart">
          ${months.map(m => `
            <div class="bar-col">
              <div class="bar-fill" style="height:${Math.max((m.count / maxMonth) * 100, 4)}%"></div>
              <span class="bar-count">${m.count}</span>
              <span class="bar-label">${m.label}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="stats-section">
        <h3 class="more-section-title">Status Breakdown</h3>
        <div class="status-bars">
          <div class="status-bar-row">
            <span class="badge badge-draft">Draft</span>
            <div class="status-bar-track"><div class="status-bar-fill" style="width:${jokes.length ? (statusCounts.draft / jokes.length) * 100 : 0}%; background:#FDCB6E"></div></div>
            <span class="status-bar-num">${statusCounts.draft}</span>
          </div>
          <div class="status-bar-row">
            <span class="badge badge-polished">Polished</span>
            <div class="status-bar-track"><div class="status-bar-fill" style="width:${jokes.length ? (statusCounts.polished / jokes.length) * 100 : 0}%; background:#55EFC4"></div></div>
            <span class="status-bar-num">${statusCounts.polished}</span>
          </div>
          <div class="status-bar-row">
            <span class="badge badge-retired">Retired</span>
            <div class="status-bar-track"><div class="status-bar-fill" style="width:${jokes.length ? (statusCounts.retired / jokes.length) * 100 : 0}%; background:#B2BEC3"></div></div>
            <span class="status-bar-num">${statusCounts.retired}</span>
          </div>
        </div>
      </div>

      ${topTags.length > 0 ? `
        <div class="stats-section">
          <h3 class="more-section-title">Popular Tags</h3>
          <div class="tag-cloud">
            ${topTags.map(([tag, count]) => `
              <span class="tag-cloud-item" style="font-size:${0.75 + (count / topTags[0][1]) * 0.5}rem">${UI.esc(tag)} <small>(${count})</small></span>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }
};

export default Stats;
