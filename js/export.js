/**
 * export.js — Export jokes to proper .docx and backup/restore as JSON
 * Uses JSZip (loaded globally via script tag) to build real .docx files
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

function escXml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Build a paragraph in OpenXML */
function wxPara(text, opts = {}) {
  const { bold, size, color, spacing } = opts;
  let rPr = '';
  if (bold) rPr += '<w:b/>';
  if (size) rPr += `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
  if (color) rPr += `<w:color w:val="${color}"/>`;
  const rPrTag = rPr ? `<w:rPr>${rPr}</w:rPr>` : '';

  let pPr = '';
  if (spacing) pPr = `<w:pPr><w:spacing w:after="${spacing}"/></w:pPr>`;

  // Handle multi-line text
  const lines = text.split('\n');
  const runs = lines.map((line, i) => {
    let r = `<w:r>${rPrTag}<w:t xml:space="preserve">${escXml(line)}</w:t></w:r>`;
    if (i < lines.length - 1) r += '<w:r><w:br/></w:r>';
    return r;
  }).join('');

  return `<w:p>${pPr}${runs}</w:p>`;
}

/** Build a horizontal rule */
function wxHr() {
  return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="E8E0D8"/></w:pBdr></w:pPr></w:p>`;
}

const Export = {
  /** Export jokes to a proper .docx file */
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
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    // Build document body XML
    let bodyXml = '';
    bodyXml += wxPara(title, { bold: true, size: 40, color: '6C5CE7', spacing: 60 });
    bodyXml += wxPara(`${jokes.length} jokes \u2022 Exported ${dateStr}`, { size: 20, color: '636E72', spacing: 200 });

    jokes.forEach((joke, i) => {
      const jp = perfMap[joke.id] || [];
      const avgRating = jp.length > 0
        ? (jp.reduce((s, p) => s + p.rating, 0) / jp.length).toFixed(1)
        : null;

      const heading = `${i + 1}. ${joke.premise || joke.setup || 'Untitled'}`;
      bodyXml += wxPara(heading, { bold: true, size: 28, color: '2D3436', spacing: 40 });

      if (joke.category) {
        bodyXml += wxPara(`${joke.category} \u2022 ${joke.status || 'draft'}`, { size: 18, color: '6C5CE7', spacing: 40 });
      }

      if (joke.premise) bodyXml += wxPara(`Premise: ${joke.premise}`, { spacing: 40 });
      if (joke.setup) bodyXml += wxPara(`Setup: ${joke.setup}`, { spacing: 40 });
      if (joke.punchline) bodyXml += wxPara(`Punchline: ${joke.punchline}`, { spacing: 40 });

      if (joke.tags?.length) {
        bodyXml += wxPara(`Tags: ${joke.tags.join(', ')}`, { size: 18, color: '636E72', spacing: 40 });
      }
      if (avgRating) {
        bodyXml += wxPara(`Avg rating: ${avgRating}/5 (${jp.length} performance${jp.length > 1 ? 's' : ''})`, { size: 18, color: '636E72', spacing: 40 });
      }

      bodyXml += wxHr();
      bodyXml += wxPara('', { spacing: 120 }); // spacer
    });

    // Assemble the .docx (a ZIP with XML files)
    const zip = new JSZip();

    // [Content_Types].xml
    zip.file('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>'
    );

    // _rels/.rels
    zip.file('_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>'
    );

    // word/_rels/document.xml.rels
    zip.file('word/_rels/document.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '</Relationships>'
    );

    // word/document.xml
    zip.file('word/document.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' +
      bodyXml +
      '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>' +
      '</w:body>' +
      '</w:document>'
    );

    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.docx';
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
