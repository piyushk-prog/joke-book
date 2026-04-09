/**
 * more.js — Settings, tools, and about page
 */

import DB from './db.js';
import UI from './ui.js';
import Export from './export.js';

const More = {
  async renderPage() {
    const darkMode = await DB.getSetting('darkMode', false);
    const jokeCount = await DB.count('jokes');
    const captureCount = await DB.count('captures');
    const setCount = await DB.count('setlists');
    const perfCount = await DB.count('performances');

    const app = document.getElementById('app-content');

    app.innerHTML = `
      <div class="view-header">
        <h1>More</h1>
      </div>

      <div class="more-section">
        <div class="more-item" id="toggle-dark">
          <div class="more-item-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            <span>Dark Mode</span>
          </div>
          <label class="toggle">
            <input type="checkbox" id="dark-toggle" ${darkMode ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div class="more-section">
        <h3 class="more-section-title">Tools</h3>
        <div class="more-item" id="goto-timer">
          <div class="more-item-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Practice Timer</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="more-item" id="goto-stats">
          <div class="more-item-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
            <span>Stats & Insights</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>

      <div class="more-section">
        <h3 class="more-section-title">Export</h3>
        <div class="more-item" id="export-word">
          <div class="more-item-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span>Export All Jokes to Word</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>

      <div class="more-section">
        <h3 class="more-section-title">Data</h3>
        <div class="more-item" id="backup-json">
          <div class="more-item-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Backup Data (JSON)</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="more-item" id="restore-json">
          <div class="more-item-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>Restore from Backup</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>

      <div class="more-section more-stats">
        <h3 class="more-section-title">Stats</h3>
        <div class="stats-grid">
          <div class="stat-item"><span class="stat-num">${jokeCount}</span><span class="stat-label">Jokes</span></div>
          <div class="stat-item"><span class="stat-num">${captureCount}</span><span class="stat-label">Captures</span></div>
          <div class="stat-item"><span class="stat-num">${setCount}</span><span class="stat-label">Sets</span></div>
          <div class="stat-item"><span class="stat-num">${perfCount}</span><span class="stat-label">Performances</span></div>
        </div>
      </div>

      <div class="more-about">
        <p>JokeBook v1.0</p>
        <p>All data stored locally on your device.</p>
      </div>
    `;

    More.bindEvents();
  },

  bindEvents() {
    // Dark mode toggle
    document.getElementById('dark-toggle')?.addEventListener('change', async (e) => {
      const dark = e.target.checked;
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      await DB.setSetting('darkMode', dark);
    });

    document.getElementById('toggle-dark')?.addEventListener('click', (e) => {
      if (e.target.closest('.toggle')) return; // let checkbox handle it
      const cb = document.getElementById('dark-toggle');
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    });

    // Timer
    document.getElementById('goto-timer')?.addEventListener('click', () => {
      window.location.hash = '#/timer';
    });

    // Stats
    document.getElementById('goto-stats')?.addEventListener('click', () => {
      window.location.hash = '#/stats';
    });

    // Export
    document.getElementById('export-word')?.addEventListener('click', () => {
      Export.exportToWord();
    });

    // Backup
    document.getElementById('backup-json')?.addEventListener('click', () => {
      Export.backupJSON();
    });

    // Restore
    document.getElementById('restore-json')?.addEventListener('click', async () => {
      const restored = await Export.restoreJSON();
      if (restored) More.renderPage();
    });
  },

  /** Apply saved theme on app start */
  async applyTheme() {
    const dark = await DB.getSetting('darkMode', false);
    if (dark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }
};

export default More;
