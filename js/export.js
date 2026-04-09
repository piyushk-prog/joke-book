/**
 * export.js — Export jokes to Word (.doc) and backup/restore as JSON
 */

import DB from './db.js';
import UI from './ui.js';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const Export = {
  /** Export all jokes (or a subset) to a Word-compatible .doc file */
  async exportToWord(jokes, title = 'My Jokes') {
    if (!jokes) jokes = await DB.getAll('jokes');
    if (jokes.length === 0) { UI.toast('No jokes to export'); return; }

    jokes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    const perfs = await DB.getAll('performances');
    const perfMap = {};
    for (const p of perfs) {
      if (!perfMap[p.jokeId]) perfMap[p.jokeId] = [];
      perfMap[p.jokeId].push(p);
    }

    const ratingLabels = ['', 'Bombed', 'Meh', 'OK', 'Good', 'Killed'];

    let jokesHtml = '';
    jokes.forEach((joke, i) => {
      const jp = perfMap[joke.id] || [];
      const avgRating = jp.length > 0
        ? (jp.reduce((s, p) => s + p.rating, 0) / jp.length).toFixed(1)
        : null;

      jokesHtml += `
        <div style="margin-bottom:24pt; page-break-inside:avoid;">
          <p style="font-size:14pt; font-weight:bold; margin-bottom:6pt; color:#2D3436;">
            ${i + 1}. ${escHtml(joke.premise || joke.setup || 'Untitled')}
          </p>
          ${joke.category ? `<p style="font-size:9pt; color:#6C5CE7; margin-bottom:4pt;">${escHtml(joke.category)} &bull; ${escHtml(joke.status || 'draft')}</p>` : ''}
          ${joke.premise ? `<p style="margin-bottom:4pt;"><b>Premise:</b> ${escHtml(joke.premise)}</p>` : ''}
          ${joke.setup ? `<p style="margin-bottom:4pt;"><b>Setup:</b> ${escHtml(joke.setup)}</p>` : ''}
          ${joke.punchline ? `<p style="margin-bottom:4pt;"><b>Punchline:</b> ${escHtml(joke.punchline)}</p>` : ''}
          ${joke.tags?.length ? `<p style="font-size:9pt; color:#636E72;">Tags: ${escHtml(joke.tags.join(', '))}</p>` : ''}
          ${avgRating ? `<p style="font-size:9pt; color:#636E72;">Avg rating: ${avgRating}/5 (${jp.length} performance${jp.length > 1 ? 's' : ''})</p>` : ''}
          <hr style="border:none; border-top:1px solid #E8E0D8; margin-top:12pt;">
        </div>
      `;
    });

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>${escHtml(title)}</title>
        <style>
          body { font-family: Calibri, sans-serif; font-size: 11pt; color: #2D3436; padding: 24pt; }
          h1 { font-size: 20pt; color: #6C5CE7; margin-bottom: 6pt; }
          .subtitle { font-size: 10pt; color: #636E72; margin-bottom: 24pt; }
        </style>
      </head>
      <body>
        <h1>${escHtml(title)}</h1>
        <p class="subtitle">${jokes.length} jokes &bull; Exported ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        ${jokesHtml}
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/msword' });
    const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.doc';
    downloadBlob(blob, filename);
    UI.toast('Word file downloaded');
  },

  /** Export a set list to Word */
  async exportSetToWord(setId) {
    const set = await DB.get('setlists', setId);
    if (!set) { UI.toast('Set not found'); return; }

    const jokes = [];
    for (const jid of (set.jokeIds || [])) {
      const j = await DB.get('jokes', jid);
      if (j) jokes.push(j);
    }

    await Export.exportToWord(jokes, set.name || 'Set List');
  },

  /** Export all data as JSON backup */
  async backupJSON() {
    const data = await DB.exportAll();
    data._meta = {
      app: 'JokeBook',
      version: 1,
      exportedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `jokebook-backup-${date}.json`);
    UI.toast('Backup downloaded');
  },

  /** Import JSON backup */
  async restoreJSON() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) { resolve(false); return; }

        try {
          const text = await file.text();
          const data = JSON.parse(text);

          if (!data._meta || data._meta.app !== 'JokeBook') {
            UI.toast('Not a valid JokeBook backup');
            resolve(false);
            return;
          }

          const ok = await UI.confirm(
            'Restore backup?',
            'This will merge the backup data with your existing jokes. No data will be deleted.'
          );
          if (!ok) { resolve(false); return; }

          delete data._meta;
          await DB.importAll(data);
          UI.toast('Backup restored');
          resolve(true);
        } catch {
          UI.toast('Failed to read backup file');
          resolve(false);
        }
      };
      input.click();
    });
  }
};

export default Export;
