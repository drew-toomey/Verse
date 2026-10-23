/* Verse — a journal in verse. Every verse is kept in the journal with how you felt;
   the finished ones are published to volumes on your shelf. */
(() => {
  'use strict';

  const STORE_KEY = 'verse.v2';
  const OLD_KEY = 'verse.book.v1';
  const UI_KEY = 'verse.ui';
  const $ = (sel) => document.querySelector(sel);

  // The in-chat preview runs inside a sandboxed frame without downloads or printing.
  const framed = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  if (framed) document.documentElement.classList.add('is-framed');

  /* ---------------- Vocabulary ---------------- */

  // Book cloth, after a shelf of old hardbacks: leather, cloth and gilt.
  const BINDINGS = {
    oxblood: { label: 'Oxblood', cloth: '#74271f', ink: '#ead2a0' },
    burgundy: { label: 'Burgundy', cloth: '#561c27', ink: '#e7cd9a' },
    honey: { label: 'Honey leather', cloth: '#b47c45', ink: '#3a2414' },
    teal: { label: 'Teal', cloth: '#285855', ink: '#e4cf9c' },
    sage: { label: 'Sage', cloth: '#58794a', ink: '#f0deb0' },
    bottle: { label: 'Bottle green', cloth: '#2a5037', ink: '#e6d09d' },
    olive: { label: 'Olive', cloth: '#6c7740', ink: '#f2e3b8' },
    ivory: { label: 'Ivory', cloth: '#ece3cc', ink: '#3b2e20' },
  };
  const coverStyle = (binding) => {
    const b = BINDINGS[binding] || BINDINGS.oxblood;
    return `--cover:${b.cloth};--cover-ink:${b.ink}`;
  };

  const FEELINGS = [
    ['joyful', '#c69332'], ['grateful', '#b67a3c'], ['hopeful', '#8d9a45'], ['calm', '#5d8c84'],
    ['tender', '#c48a84'], ['in love', '#a8444f'], ['wistful', '#8a7aa8'], ['lonely', '#6b7290'],
    ['sad', '#4e6d95'], ['anxious', '#b46c3a'], ['angry', '#8e3224'], ['numb', '#8d867b'],
  ];
  const feelingColour = Object.fromEntries(FEELINGS);
  const KINDS = { moment: 'a moment', thought: 'a thought', memory: 'a memory' };

  /* ---------------- Storage ---------------- */

  const nowISO = () => new Date().toISOString();
  const str = (x) => (typeof x === 'string' ? x : '');
  // Verse bodies mark *italic* and **bold**; a backslash keeps a literal * or \.
  const escapeMarks = (text) => text.replace(/[\\*]/g, (c) => `\\${c}`);
  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

  function defaults() {
    return {
      author: '',
      volumes: [],
      verses: [],
      prefs: { font: 'garamond', paper: 'sepia', size: 'm', align: 'center' },
      welcomed: false,
      lastBackup: null,
    };
  }

  function cleanVolume(v) {
    const created = str(v.createdAt) || nowISO();
    return {
      id: String(v.id),
      title: str(v.title).trim() || 'Untitled',
      note: str(v.note),
      binding: v.binding in BINDINGS ? v.binding : 'oxblood',
      createdAt: created,
      updatedAt: str(v.updatedAt) || created,
    };
  }

  function cleanVerse(p) {
    const created = str(p.createdAt) || nowISO();
    return {
      id: String(p.id),
      title: str(p.title),
      // Bodies saved before italics existed are plain text: keep their * and \ literal.
      body: p.fmt ? str(p.body) : escapeMarks(str(p.body)),
      fmt: 1,
      align: p.align === 'left' ? 'left' : 'center',
      feeling: feelingColour[p.feeling] ? p.feeling : null,
      kind: p.kind in KINDS ? p.kind : null,
      createdAt: created,
      updatedAt: str(p.updatedAt) || created,
      volumeId: str(p.volumeId) || null,
      publishedAt: str(p.publishedAt) || null,
    };
  }

  // The first version kept a single book. It becomes the first volume on the shelf.
  function fromV1(d) {
    const base = defaults();
    const book = d.book || {};
    const vol = cleanVolume({ id: uid(), title: book.title || 'Verse', createdAt: book.begun });
    return {
      ...base,
      author: str(book.author),
      prefs: { ...base.prefs, ...(d.prefs || {}) },
      volumes: [vol],
      verses: d.poems.filter((p) => p && p.id).map((p) =>
        cleanVerse({ ...p, volumeId: p.boundAt ? vol.id : null, publishedAt: p.boundAt || null })),
      welcomed: Boolean(d.welcomed),
      lastBackup: str(d.lastBackup) || null,
    };
  }

  function normalise(d) {
    if (!d || typeof d !== 'object') return defaults();
    if (Array.isArray(d.poems)) return fromV1(d);
    const base = defaults();
    const volumes = Array.isArray(d.volumes) ? d.volumes.filter((v) => v && v.id).map(cleanVolume) : [];
    const ids = new Set(volumes.map((v) => v.id));
    const verses = Array.isArray(d.verses) ? d.verses.filter((p) => p && p.id).map(cleanVerse) : [];
    for (const p of verses) {
      if (p.volumeId && !ids.has(p.volumeId)) p.volumeId = null;
      if (!p.volumeId) p.publishedAt = null;
      else if (!p.publishedAt) p.publishedAt = p.updatedAt;
    }
    return {
      author: str(d.author),
      volumes,
      verses,
      prefs: { ...base.prefs, ...(d.prefs || {}) },
      welcomed: Boolean(d.welcomed),
      lastBackup: str(d.lastBackup) || null,
    };
  }

  let storageOK = true;

  function load() {
    let raw = null;
    let key = STORE_KEY;
    try {
      raw = localStorage.getItem(STORE_KEY);
      if (!raw) {
        raw = localStorage.getItem(OLD_KEY);
        key = OLD_KEY;
      }
    } catch {
      storageOK = false;
      return defaults();
    }
    if (!raw) return defaults();
    try {
      return normalise(JSON.parse(raw));
    } catch {
      // Never overwrite something we couldn't read; set it aside first.
      try { localStorage.setItem(`${key}.unreadable.${Date.now()}`, raw); } catch { /* ignore */ }
      return defaults();
    }
  }

  function save() {
    if (!storageOK) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch {
      toast('Couldn’t save. Your device storage may be full.');
    }
  }

  let state = load();

  // Where you were: the open tab, shelf order and the last page read in each volume.
  const ui = (() => {
    const base = { tab: 'journal', sort: 'recent', pages: {} };
    try { return { ...base, ...JSON.parse(localStorage.getItem(UI_KEY) || '{}') }; } catch { return base; }
  })();
  function saveUI() {
    try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* ignore */ }
  }

  const volumeById = (id) => (id && state.volumes.find((v) => v.id === id)) || null;
  const versesIn = (id) =>
    state.verses.filter((p) => p.volumeId === id).sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const pageOf = (verse) => versesIn(verse.volumeId).findIndex((p) => p.id === verse.id) + 1;

  function lastActivity(vol) {
    return versesIn(vol.id).reduce((latest, p) => (p.publishedAt > latest ? p.publishedAt : latest), vol.updatedAt);
  }
  function sortedVolumes() {
    const list = state.volumes.slice();
    if (ui.sort === 'title') return list.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    return list.sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
  }

  /* ---------------- Helpers ---------------- */

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }

  const longDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const fullDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const monthYear = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  const fmtLong = (iso) => longDate.format(new Date(iso));

  function backupAge(iso) {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return 'Last backup: today.';
    if (days === 1) return 'Last backup: yesterday.';
    if (days < 30) return `Last backup: ${days} days ago.`;
    return `Last backup: ${shortDate.format(new Date(iso))}. Time for another?`;
  }

  function toRoman(n) {
    const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
      [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
    return out;
  }

  const countVerses = (n) => (n === 1 ? '1 verse' : `${n} verses`);
  const countVolumes = (n) => (n === 1 ? '1 volume' : `${n} volumes`);

  /* A verse body is text with light marks: *italic*, **bold**, and a backslash to keep
     a literal * or \. Marks never run past the end of a line. */

  // One marked line → runs of { text, i, b }.
  function parseLine(line) {
    const runs = [];
    let i = false;
    let b = false;
    let text = '';
    const push = () => {
      if (text) runs.push({ text, i, b });
      text = '';
    };
    for (let k = 0; k < line.length; k += 1) {
      const c = line[k];
      if (c === '\\' && k + 1 < line.length) {
        k += 1;
        text += line[k];
      } else if (c === '*' && line[k + 1] === '*') {
        push();
        b = !b;
        k += 1;
      } else if (c === '*') {
        push();
        i = !i;
      } else {
        text += c;
      }
    }
    push();
    return runs;
  }

  // Runs → one marked line; the inverse of parseLine.
  function markLine(runs) {
    let out = '';
    let i = false;
    let b = false;
    for (const r of runs) {
      if (r.b !== b) { out += '**'; b = r.b; }
      if (r.i !== i) { out += '*'; i = r.i; }
      out += escapeMarks(r.text);
    }
    if (b) out += '**';
    if (i) out += '*';
    return out;
  }

  const plainLine = (line) => parseLine(line).map((r) => r.text).join('');
  const plainOf = (body) => body.split('\n').map(plainLine).join('\n');
  const isBlank = (line) => !plainLine(line).trim();

  // A marked line as nodes, using the given tags for italic and bold.
  function richLine(line, { em = 'em', strong = 'strong', trim = false } = {}) {
    const runs = parseLine(line);
    if (trim && runs.length) {
      runs[0].text = runs[0].text.trimStart();
      runs[runs.length - 1].text = runs[runs.length - 1].text.trimEnd();
    }
    return runs.filter((r) => r.text).map((r) => {
      if (r.i && r.b) return h(strong, {}, h(em, { text: r.text }));
      if (r.i) return h(em, { text: r.text });
      if (r.b) return h(strong, { text: r.text });
      return document.createTextNode(r.text);
    });
  }

  // The lines of a verse as they appear on a page: no blank lines at either end.
  function pageLines(body) {
    const ls = body.split('\n');
    while (ls.length && isBlank(ls[0])) ls.shift();
    while (ls.length && isBlank(ls[ls.length - 1])) ls.pop();
    return ls;
  }
  const richBody = (body) => pageLines(body).flatMap((line, k) => [k ? '\n' : null, ...richLine(line)]);

  const lines = (body) => plainOf(body).split('\n').map((l) => l.trim()).filter(Boolean);
  function firstLine(body) {
    const line = lines(body)[0] || '';
    return line.length > 52 ? `${line.slice(0, 50).trimEnd()}…` : line;
  }
  const hasTitle = (p) => Boolean(p.title.trim());
  const displayTitle = (p) => p.title.trim() || firstLine(p.body) || 'Untitled';
  const feelingNote = (p) => [p.feeling, KINDS[p.kind]].filter(Boolean).join(' · ');
  const dot = (feeling) => h('i', { class: 'dot', style: feeling ? `--mood:${feelingColour[feeling]}` : null });

  let toastTimer = 0;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 2800);
  }

  // A light tick, like a native Android control. Phones without vibration ignore it.
  function haptic(pattern = 8) {
    try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
  }

  function requestPersistence() {
    try { navigator.storage?.persist?.().catch(() => {}); } catch { /* ignore */ }
  }

  /* ---------------- Look & feel ---------------- */

  const themeColor = { sepia: '#e7dcc6', night: '#15110d' };

  function applyPrefs() {
    const root = document.documentElement;
    root.dataset.font = state.prefs.font;
    root.dataset.paper = state.prefs.paper;
    root.dataset.size = state.prefs.size;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = themeColor[state.prefs.paper] || themeColor.sepia;
  }

  function coverEl(vol, { badge = true } = {}) {
    const count = badge ? versesIn(vol.id).length : 0;
    const author = state.author.trim();
    const longest = Math.max(...vol.title.split(/\s+/).map((w) => w.length));
    const fit = longest > 10 ? ' is-tighter' : longest > 7 ? ' is-tight' : '';
    return h('span', { class: 'cover', style: coverStyle(vol.binding) },
      h('span', { class: 'cover-frame' },
        h('span', { class: `cover-title${fit}`, text: vol.title }),
        h('span', { class: 'cover-orn' }),
        author ? h('span', { class: 'cover-author', text: author }) : null,
      ),
      count ? h('span', { class: 'cover-badge', 'aria-hidden': 'true', text: String(count) }) : null,
    );
  }

  /* ---------------- Views & history ---------------- */

  let view = 'home'; // 'home' or 'volume'; the writer opens over either
  let openVol = null;
  let homeScroll = 0;
  let ignorePop = false;

  const writer = $('#writer');
  const dialogs = ['#settings', '#publish', '#vol-edit', '#confirm'].map((s) => $(s));
  const isWriting = () => !writer.hidden;
  const openDialog = () => dialogs.find((d) => d.open);
  const layered = () => Boolean(openDialog()) || isWriting() || view === 'volume';

  function setView(next) {
    view = next;
    document.body.dataset.view = next;
    $('#home').hidden = next !== 'home';
    $('#volume').hidden = next !== 'volume';
  }

  // One extra history entry while a sheet, a volume or the writer is open,
  // so Android's back gesture closes it instead of leaving the app.
  function holdHistory() {
    if (!framed && history.state?.verse !== 'layer') history.pushState({ verse: 'layer' }, '');
  }
  function releaseHistory() {
    if (!framed && !layered() && history.state?.verse === 'layer') {
      ignorePop = true;
      history.back();
    }
  }
  window.addEventListener('popstate', () => {
    if (ignorePop) {
      ignorePop = false;
      return;
    }
    const sheet = openDialog();
    if (sheet) sheet.close();
    else if (isWriting()) closeWriter();
    else if (view === 'volume') closeVolume();
    if (layered()) holdHistory();
  });

  function showHome() {
    renderHome();
    window.scrollTo(0, homeScroll);
  }

  /* ---------------- Home: journal ---------------- */

  let filter = 'all';
  const searchInput = $('#search');

  function renderHome() {
    $('#tab-journal').hidden = ui.tab !== 'journal';
    $('#tab-shelf').hidden = ui.tab !== 'shelf';
    for (const b of document.querySelectorAll('.tab-btn')) {
      if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    if (ui.tab === 'shelf') renderShelf();
    else renderJournal();
  }

  function showTab(tab) {
    if (ui.tab === tab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    ui.tab = tab;
    saveUI();
    renderHome();
    window.scrollTo(0, 0);
  }

  function renderJournal() {
    for (const c of document.querySelectorAll('[data-filter]')) {
      c.setAttribute('aria-pressed', String(c.dataset.filter === filter));
    }
    const q = searchInput.value.trim().toLowerCase();
    let list = state.verses.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter === 'unpublished') list = list.filter((p) => !p.volumeId);
    if (filter === 'published') list = list.filter((p) => p.volumeId);
    if (q) {
      list = list.filter((p) =>
        [p.title, plainOf(p.body), p.feeling || '', KINDS[p.kind] || '', volumeById(p.volumeId)?.title || '']
          .join('\n').toLowerCase().includes(q));
    }

    const root = $('#journal');
    if (!list.length) {
      root.replaceChildren(emptyJournal(q));
      return;
    }
    const months = new Map();
    for (const p of list) {
      const d = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!months.has(key)) months.set(key, []);
      months.get(key).push(p);
    }
    root.replaceChildren(...[...months.values()].map(monthSection));
  }

  function monthSection(items) {
    return h('section', { class: 'month' },
      h('h2', { class: 'month-head' },
        h('span', { text: monthYear.format(new Date(items[0].createdAt)) }),
        h('span', { class: 'month-dots', 'aria-hidden': 'true' }, items.slice().reverse().map((p) => dot(p.feeling))),
      ),
      h('ul', { class: 'entries' }, items.map(entryCard)),
    );
  }

  function entryCard(p) {
    const d = new Date(p.createdAt);
    const vol = volumeById(p.volumeId);
    const rest = p.body.split('\n').filter((l) => !isBlank(l)).slice(hasTitle(p) ? 0 : 1)
      .flatMap((l, k) => [k ? ' / ' : null, ...richLine(l, { trim: true })]);
    const note = feelingNote(p);
    return h('li', {},
      h('button', { class: 'entry', type: 'button', onclick: () => openWriter(p.id) },
        h('span', { class: 'entry-when' },
          h('span', { class: 'entry-day', text: String(d.getDate()) }),
          h('span', { class: 'entry-weekday', text: weekday.format(d) }),
        ),
        h('span', { class: 'entry-main' },
          h('span', { class: `entry-title${hasTitle(p) ? '' : ' is-first-line'}`, text: displayTitle(p) }),
          rest.length ? h('span', { class: 'entry-excerpt' }, rest) : null,
          note || vol
            ? h('span', { class: 'entry-meta' },
              note ? h('span', { class: 'entry-feeling' }, p.feeling ? dot(p.feeling) : null, note) : null,
              vol ? h('span', { class: 'entry-volume' }, h('i', { class: 'mini-cover', style: coverStyle(vol.binding) }), vol.title) : null)
            : null,
        ),
      ),
    );
  }

  function emptyJournal(q) {
    if (!state.verses.length) {
      return h('div', { class: 'empty' },
        h('p', { class: 'empty-title', text: 'Your journal is empty' }),
        h('p', { class: 'empty-text', text: 'Write about a moment, a thought or a memory. Every verse is kept here, dated, with how you felt.' }),
        h('button', { class: 'pill-btn', type: 'button', text: 'Write your first verse', onclick: () => openWriter() }),
      );
    }
    let text = 'Nothing here yet.';
    if (q) text = `Nothing matches “${searchInput.value.trim()}”.`;
    else if (filter === 'unpublished') text = 'Everything you’ve written is in a volume.';
    else if (filter === 'published') text = 'Nothing published yet. Open a verse and choose Publish.';
    return h('div', { class: 'empty' }, h('p', { class: 'empty-text', text }));
  }

  searchInput.addEventListener('input', renderJournal);
  for (const c of document.querySelectorAll('[data-filter]')) {
    c.addEventListener('click', () => {
      filter = c.dataset.filter;
      renderJournal();
    });
  }
  for (const b of document.querySelectorAll('.tab-btn')) b.addEventListener('click', () => showTab(b.dataset.tab));
  $('#write-btn').addEventListener('click', () => openWriter());

  /* ---------------- Home: shelf ---------------- */

  let shelfCols = 0;
  const colsFor = (width) => (width < 520 ? 3 : width < 760 ? 4 : 5);

  function renderShelf() {
    const vols = sortedVolumes();
    const published = state.verses.filter((p) => p.volumeId).length;
    $('#shelf-summary').textContent = !vols.length
      ? 'No volumes yet'
      : published ? `${countVolumes(vols.length)} · ${published} published` : countVolumes(vols.length);
    const sortBtn = $('#sort-btn');
    sortBtn.textContent = ui.sort === 'title' ? 'A–Z' : 'Recent';
    sortBtn.setAttribute('aria-label', `Sorted by ${ui.sort === 'title' ? 'title' : 'most recent'}. Change order`);

    const tiles = vols.map((v) => {
      const n = versesIn(v.id).length;
      return h('li', {},
        h('button', { class: 'cover-btn', type: 'button', 'aria-label': `${v.title}, ${countVerses(n)}`, onclick: () => openVolume(v.id) }, coverEl(v)));
    });
    tiles.push(h('li', {},
      h('button', { class: 'cover-btn', type: 'button', onclick: () => openVolumeEditor(null) },
        h('span', { class: 'cover cover--new' },
          h('span', { class: 'plus', 'aria-hidden': 'true', text: '+' }),
          h('span', { class: 'new-label', text: 'New volume' }),
        ),
      ),
    ));

    shelfCols = colsFor($('#tab-shelf').clientWidth || window.innerWidth);
    const rows = [];
    for (let i = 0; i < tiles.length; i += shelfCols) {
      rows.push(h('ul', { class: 'shelf-row', style: `--cols:${shelfCols}` }, tiles.slice(i, i + shelfCols)));
    }
    const note = vols.length
      ? null
      : h('p', { class: 'shelf-note', text: 'Volumes hold your finished verses: a season, a place, a person, a time in your life.' });
    $('#shelf').replaceChildren(...rows, ...(note ? [note] : []));
  }

  $('#sort-btn').addEventListener('click', () => {
    ui.sort = ui.sort === 'title' ? 'recent' : 'title';
    saveUI();
    renderShelf();
  });

  window.addEventListener('resize', () => {
    if (view === 'home' && ui.tab === 'shelf' && colsFor($('#tab-shelf').clientWidth || window.innerWidth) !== shelfCols) renderShelf();
  });

  /* ---------------- A volume, read as a book ---------------- */

  const book = $('#book');
  let currentKey = 'cover';

  function page(key, cls, paperStyle, ...content) {
    return h('article', { class: `page ${cls}`, dataset: { key } },
      h('div', { class: 'paper', style: paperStyle }, ...content));
  }

  function yearsOf(vol, verses) {
    if (!verses.length) return toRoman(new Date(vol.createdAt).getFullYear());
    const years = verses.map((p) => new Date(p.createdAt).getFullYear());
    const first = Math.min(...years);
    const last = Math.max(...years);
    return first === last ? toRoman(first) : `${toRoman(first)} – ${toRoman(last)}`;
  }

  function coverPage(vol, verses) {
    const author = state.author.trim();
    return page('cover', 'page--cover', coverStyle(vol.binding),
      h('div', { class: 'vol-cover' },
        h('h1', { class: `vol-cover-title${vol.title.length > 12 ? ' is-long' : ''}`, text: vol.title }),
        h('span', { class: 'cover-orn', 'aria-hidden': 'true' }),
        author ? h('p', { class: 'vol-cover-author', text: author }) : null,
        vol.note.trim() ? h('p', { class: 'vol-cover-note', text: vol.note.trim() }) : null,
      ),
      h('div', { class: 'vol-cover-foot' },
        h('p', { class: 'vol-cover-year', text: yearsOf(vol, verses) }),
        verses.length
          ? [
            h('p', { class: 'vol-cover-count', text: countVerses(verses.length) }),
            h('button', { class: 'link-btn', type: 'button', text: 'Turn the page', onclick: () => goTo('contents') }),
          ]
          : h('button', { class: 'link-btn', type: 'button', text: 'Write the first verse', onclick: () => openWriter(null, { volumeId: vol.id }) }),
      ),
    );
  }

  function contentsPage(verses) {
    const untitled = verses.some((p) => !hasTitle(p));
    return page('contents', 'page--contents', null,
      h('h2', { class: 'page-heading', text: 'Contents' }),
      h('ol', { class: 'toc' }, verses.map((p, i) =>
        h('li', {},
          h('button', { class: 'toc-row', type: 'button', onclick: () => goTo(p.id) },
            h('span', { class: `toc-title${hasTitle(p) ? '' : ' is-first-line'}`, text: displayTitle(p) }),
            h('span', { class: 'toc-dots', 'aria-hidden': 'true' }),
            h('span', { class: 'toc-num', text: String(i + 1) }),
          ),
        ),
      )),
      untitled ? h('p', { class: 'toc-note', text: 'Untitled verses are listed by their first line.' }) : null,
    );
  }

  function poemPage(p, n) {
    const note = feelingNote(p);
    return page(p.id, 'page--poem', null,
      h('div', { class: `poem poem--${p.align}` },
        hasTitle(p)
          ? h('h2', { class: 'poem-title', text: p.title.trim() })
          : h('div', { class: 'poem-mark', 'aria-hidden': 'true', text: '*' }),
        h('p', { class: 'poem-body' }, richBody(p.body)),
      ),
      h('footer', { class: 'page-foot' },
        h('span', { class: 'foot-when' },
          h('time', { datetime: p.createdAt, text: fmtLong(p.createdAt) }),
          note ? h('span', { class: 'foot-feeling' }, p.feeling ? dot(p.feeling) : null, note) : null,
        ),
        h('span', { class: 'folio', 'aria-label': `Page ${n}`, text: String(n) }),
        h('button', { class: 'foot-btn', type: 'button', text: 'Edit', onclick: () => openWriter(p.id) }),
      ),
    );
  }

  function endPage(vol, verses) {
    const count = verses.length;
    const face = state.prefs.font === 'typewriter' ? 'Courier Prime' : 'EB Garamond';
    const sofar = count ? ` ${count === 1 ? 'One verse' : `${count} verses`} so far.` : '';
    return page('end', 'page--end', null,
      h('div', { class: 'end' },
        h('div', { class: 'flourish', 'aria-hidden': 'true' }),
        h('p', { class: 'end-note', text: count ? 'The rest is unwritten.' : 'This volume is waiting for its first verse.' }),
        h('button', { class: 'pill-btn', type: 'button', text: count ? 'Write the next verse' : 'Write the first verse', onclick: () => openWriter(null, { volumeId: vol.id }) }),
      ),
      h('p', { class: 'colophon', text: `Set in ${face}. Begun in ${monthYear.format(new Date(vol.createdAt))}.${sofar}` }),
    );
  }

  function renderBook() {
    const vol = volumeById(openVol);
    if (!vol) return;
    const verses = versesIn(vol.id);
    const pages = [coverPage(vol, verses)];
    if (verses.length) pages.push(contentsPage(verses));
    verses.forEach((p, i) => pages.push(poemPage(p, i + 1)));
    pages.push(endPage(vol, verses));
    book.replaceChildren(...pages);
    $('#title-btn').textContent = vol.title;
    if (pageIndex(currentKey) < 0) currentKey = 'cover';
    updateTurns();
  }

  const pages = () => [...book.children];
  const pageIndex = (key) => pages().findIndex((el) => el.dataset.key === key);

  function rememberPage() {
    if (!openVol) return;
    ui.pages[openVol] = currentKey;
    saveUI();
  }

  function goTo(key, smooth = true) {
    const i = Math.max(0, pageIndex(key));
    currentKey = pages()[i]?.dataset.key || 'cover';
    book.scrollTo({ left: i * book.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
    rememberPage();
    updateTurns();
  }

  function turn(step) {
    const all = pages();
    const i = Math.min(all.length - 1, Math.max(0, pageIndex(currentKey) + step));
    goTo(all[i].dataset.key);
  }

  function updateTurns() {
    const i = pageIndex(currentKey);
    $('#turn-prev').disabled = i <= 0;
    $('#turn-next').disabled = i >= pages().length - 1;
  }

  let scrollTimer = 0;
  book.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (!book.clientWidth) return;
      const el = pages()[Math.round(book.scrollLeft / book.clientWidth)];
      if (el && el.dataset.key !== currentKey) {
        currentKey = el.dataset.key;
        rememberPage();
        updateTurns();
      }
    }, 120);
  }, { passive: true });

  // Keep the same page in view when the phone rotates or the window resizes.
  new ResizeObserver(() => {
    if (book.clientWidth) book.scrollLeft = Math.max(0, pageIndex(currentKey)) * book.clientWidth;
  }).observe(book);

  function openVolume(id, { at = null, fresh = false } = {}) {
    if (!volumeById(id)) return;
    if (view === 'home' && !isWriting()) homeScroll = window.scrollY;
    openVol = id;
    currentKey = at || ui.pages[id] || 'cover';
    setView('volume');
    holdHistory();
    renderBook();
    goTo(currentKey, false);
    if (fresh && at) book.children[pageIndex(at)]?.querySelector('.paper')?.classList.add('is-new');
  }

  function closeVolume() {
    if (view !== 'volume') return;
    openVol = null;
    setView('home');
    showHome();
    releaseHistory();
  }

  $('#vol-back').addEventListener('click', closeVolume);
  $('#vol-menu').addEventListener('click', () => openVolumeEditor(openVol));
  $('#vol-write').addEventListener('click', () => openWriter(null, { volumeId: openVol }));
  $('#turn-prev').addEventListener('click', () => turn(-1));
  $('#turn-next').addEventListener('click', () => turn(1));
  $('#title-btn').addEventListener('click', () => goTo('cover'));

  /* ---------------- The writer ---------------- */

  const titleInput = $('#poem-title');
  const bodyInput = $('#poem-body');
  const alignBtn = $('#align-btn');
  const publishBtn = $('#publish-btn');
  const deleteBtn = $('#delete-btn');

  let current = null; // the verse being edited, once it has been saved at least once
  let context = null; // the volume the writer was opened from, offered first when publishing
  let draft = { align: 'center', feeling: null, kind: null };
  let changed = false;
  let saveTimer = 0;

  $('#feelings').append(...FEELINGS.map(([name, colour]) =>
    h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', dataset: { feeling: name }, style: `--mood:${colour}`, onclick: () => pick('feeling', name) },
      h('i', { class: 'dot' }), name)));
  $('#kinds').append(...Object.entries(KINDS).map(([key, label]) =>
    h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', dataset: { kind: key }, onclick: () => pick('kind', key) }, label)));

  function renderChoices() {
    for (const c of $('#feelings').children) c.setAttribute('aria-pressed', String(c.dataset.feeling === draft.feeling));
    for (const c of $('#kinds').children) c.setAttribute('aria-pressed', String(c.dataset.kind === draft.kind));
  }

  function pick(field, value) {
    draft[field] = draft[field] === value ? null : value;
    haptic();
    renderChoices();
    persist();
    refreshWriterChrome();
  }

  /* The verse editor holds one <div> per line with <i> and <b> inside, the same
     shape the browser builds as you type. */

  const BLOCKS = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

  // The editor's content → marked text. Tolerant of whatever the browser makes while
  // editing: line <div>s, <br>s, <b>/<i>, <strong>/<em> and styled spans.
  function readEditor() {
    const out = [[]];
    let pending = false; // a line break waiting for the next content
    const add = (text, f) => {
      if (pending) {
        out.push([]);
        pending = false;
      }
      const line = out[out.length - 1];
      const last = line[line.length - 1];
      if (last && last.i === f.i && last.b === f.b) last.text += text;
      else line.push({ text, i: f.i, b: f.b });
    };
    const lineBreak = () => {
      if (pending) out.push([]);
      pending = true;
    };
    const walk = (node, f) => {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          child.nodeValue.replace(/\u00a0/g, ' ').split('\n').forEach((part, k) => {
            if (k) lineBreak();
            if (part) add(part, f);
          });
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.tagName === 'BR') {
            lineBreak();
            continue;
          }
          const tag = child.tagName;
          const { fontStyle, fontWeight } = child.style;
          const next = {
            i: fontStyle === 'italic' || (fontStyle !== 'normal' && (f.i || tag === 'I' || tag === 'EM')),
            b: /^(bold|bolder|[6-9]00)$/.test(fontWeight)
              || (!/^(normal|lighter|[1-5]00)$/.test(fontWeight) && (f.b || tag === 'B' || tag === 'STRONG')),
          };
          const block = BLOCKS.has(tag);
          if (block && (pending || out[out.length - 1].length)) {
            out.push([]);
            pending = false;
          }
          walk(child, next);
          if (block) pending = true;
        }
      }
    };
    walk(bodyInput, { i: false, b: false });
    return out.map(markLine).join('\n');
  }

  function fillEditor(body) {
    bodyInput.replaceChildren(...(body || '').split('\n').map((line) => {
      const nodes = richLine(line, { em: 'i', strong: 'b' });
      return h('div', {}, nodes.length ? nodes : h('br'));
    }));
    markEmpty();
  }

  const editorBody = () => readEditor();
  function markEmpty() {
    bodyInput.classList.toggle('is-empty', !bodyInput.textContent.trim());
  }

  function focusEditorEnd() {
    bodyInput.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(bodyInput);
    range.collapse(false);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function setAlign(value) {
    draft.align = value === 'left' ? 'left' : 'center';
    bodyInput.classList.toggle('is-left', draft.align === 'left');
    alignBtn.setAttribute('aria-pressed', String(draft.align === 'left'));
    alignBtn.setAttribute('aria-label', `Line alignment: ${draft.align === 'left' ? 'left' : 'centred'}`);
  }

  function refreshWriterChrome() {
    const vol = current ? volumeById(current.volumeId) : null;
    publishBtn.textContent = vol ? 'Done' : 'Publish';
    deleteBtn.hidden = !current;
    $('#writer-status').textContent = !current ? 'New verse' : vol ? `${vol.title} · page ${pageOf(current)}` : 'In your journal';
    $('#writer-date').textContent = fullDate.format(new Date(current ? current.createdAt : Date.now()));

    const place = $('#placement-text');
    if (vol) {
      place.replaceChildren(h('i', { class: 'mini-cover', style: coverStyle(vol.binding) }),
        h('span', {}, 'In ', h('em', { text: vol.title }), `, page ${pageOf(current)}`));
      $('#placement-btn').textContent = 'Move';
    } else {
      place.replaceChildren(h('span', { text: 'In your journal, not yet published' }));
      $('#placement-btn').textContent = 'Publish';
    }

    const body = editorBody();
    const text = plainOf(body).trim();
    const words = text ? text.split(/\s+/).length : 0;
    const count = lines(body).length;
    $('#writer-meta').textContent = words
      ? `${count === 1 ? '1 line' : `${count} lines`} · ${words === 1 ? '1 word' : `${words} words`} · saved as you write`
      : 'Saved as you write';
  }

  function openWriter(id, { volumeId = null, prefill = null } = {}) {
    closeDialogs();
    if (view === 'home' && !isWriting()) homeScroll = window.scrollY;
    current = id ? state.verses.find((p) => p.id === id) || null : null;
    context = volumeId || current?.volumeId || (view === 'volume' ? openVol : null);
    changed = false;
    titleInput.value = current ? current.title : '';
    fillEditor(current ? current.body : '');
    draft = { align: 'center', feeling: current?.feeling || null, kind: current?.kind || null };
    setAlign(current ? current.align : state.prefs.align);
    renderChoices();
    if (prefill) {
      titleInput.value = prefill.title;
      fillEditor(escapeMarks(prefill.body));
      persist();
    }

    writer.hidden = false;
    document.body.classList.add('is-writing');
    window.scrollTo(0, 0);
    refreshWriterChrome();
    holdHistory();
    if (!id) bodyInput.focus({ preventScroll: true });
  }

  function persist() {
    clearTimeout(saveTimer);
    const title = titleInput.value;
    const body = editorBody();
    const { align, feeling, kind } = draft;
    if (!current) {
      if (!title.trim() && !plainOf(body).trim()) return;
      const stamp = nowISO();
      current = { id: uid(), title, body, fmt: 1, align, feeling, kind, createdAt: stamp, updatedAt: stamp, volumeId: null, publishedAt: null };
      state.verses.push(current);
    } else if (current.title === title && current.body === body && current.align === align
      && current.feeling === feeling && current.kind === kind) {
      return;
    } else {
      Object.assign(current, { title, body, align, feeling, kind, updatedAt: nowISO() });
    }
    changed = true;
    save();
  }

  function schedulePersist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { persist(); refreshWriterChrome(); }, 450);
  }

  function hideWriter({ keepHistory = false } = {}) {
    if (!isWriting()) return;
    titleInput.blur();
    bodyInput.blur();
    writer.hidden = true;
    document.body.classList.remove('is-writing');
    if (!keepHistory) releaseHistory();
  }

  function removeVerse(id) {
    state.verses = state.verses.filter((p) => p.id !== id);
    save();
  }

  // Leave the writer. Whatever was written stays in the journal.
  function closeWriter() {
    if (!isWriting()) return;
    persist();
    if (current && current.volumeId && !plainOf(current.body).trim()) {
      toast('A page needs at least one line. Delete it instead?');
      bodyInput.focus();
      holdHistory();
      return;
    }
    let message = '';
    if (current && !current.title.trim() && !plainOf(current.body).trim()) removeVerse(current.id);
    else if (current && !current.volumeId && changed) message = 'Saved in your journal';
    const verse = current;
    current = null;
    hideWriter();
    if (view === 'volume') {
      renderBook();
      goTo(verse && verse.volumeId === openVol ? verse.id : currentKey, false);
    } else {
      showHome();
    }
    if (message) toast(message);
  }

  function openPublish() {
    persist();
    if (!plainOf(editorBody()).trim() || !current) {
      refreshWriterChrome();
      toast('Write a line or two first.');
      bodyInput.focus();
      return;
    }
    const here = current.volumeId;
    const vols = sortedVolumes();
    const first = vols.findIndex((v) => v.id === context);
    if (first > 0) vols.unshift(...vols.splice(first, 1));
    $('#publish-title').textContent = here ? 'Move to a volume' : 'Publish to a volume';
    $('#publish-list').replaceChildren(...vols.map((v) =>
      h('li', {},
        h('button', { class: 'pick-row', type: 'button', 'aria-current': v.id === here ? 'true' : null, onclick: () => publishTo(v.id) },
          h('i', { class: 'mini-cover', style: coverStyle(v.binding) }),
          h('span', { class: 'pick-name', text: v.title }),
          h('span', { class: 'pick-count', text: v.id === here ? 'here now' : countVerses(versesIn(v.id).length) }),
        ),
      )));
    $('#unpublish-btn').hidden = !here;
    openSheet($('#publish'));
  }

  function publishTo(volId) {
    closeDialogs();
    const verse = current;
    const vol = volumeById(volId);
    if (!verse || !vol) return;
    const moving = verse.volumeId !== volId;
    if (moving) {
      const stamp = nowISO();
      Object.assign(verse, { volumeId: volId, publishedAt: stamp, updatedAt: stamp });
      save();
      requestPersistence();
    }
    current = null;
    hideWriter({ keepHistory: true });
    openVolume(volId, { at: verse.id, fresh: moving });
    if (moving) {
      haptic([12, 70, 18]);
      toast(`Published in ${vol.title} as page ${pageOf(verse)}`);
    }
  }

  function unpublish() {
    if (!current) return;
    const vol = volumeById(current.volumeId);
    Object.assign(current, { volumeId: null, publishedAt: null, updatedAt: nowISO() });
    save();
    closeDialogs();
    refreshWriterChrome();
    if (vol) toast(`Taken out of ${vol.title}. It’s still in your journal.`);
  }

  async function deleteVerse() {
    if (!current) return;
    persist();
    const ok = await ask(
      current.volumeId
        ? 'Delete this verse from your journal and its volume? This can’t be undone.'
        : 'Delete this verse from your journal? This can’t be undone.',
      'Delete',
    );
    if (!ok || !current) return;
    removeVerse(current.id);
    current = null;
    hideWriter();
    if (view === 'volume') {
      renderBook();
      goTo(currentKey, false);
    } else {
      showHome();
    }
    toast('Verse deleted');
  }

  titleInput.addEventListener('input', schedulePersist);
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      focusEditorEnd();
    }
  });
  bodyInput.addEventListener('input', () => {
    markEmpty();
    schedulePersist();
  });
  // Pasted text arrives plain, so it can't bring along fonts or colours.
  bodyInput.addEventListener('paste', (e) => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  });
  bodyInput.addEventListener('drop', (e) => e.preventDefault());

  /* Formatting bar: sits above the keyboard while you write the verse. */

  const formatBar = $('#format-bar');
  let savedRange = null;

  function syncFormatBar() {
    for (const b of formatBar.querySelectorAll('[data-cmd="italic"], [data-cmd="bold"]')) {
      let on = false;
      try { on = document.queryCommandState(b.dataset.cmd); } catch { /* ignore */ }
      b.setAttribute('aria-pressed', String(on));
    }
  }

  document.addEventListener('selectionchange', () => {
    const sel = getSelection();
    if (!sel.rangeCount || !bodyInput.contains(sel.anchorNode)) return;
    savedRange = sel.getRangeAt(0).cloneRange();
    syncFormatBar();
  });

  bodyInput.addEventListener('focus', () => {
    formatBar.hidden = false;
    writer.classList.add('is-formatting');
    syncFormatBar();
  });
  bodyInput.addEventListener('blur', () => {
    formatBar.hidden = true;
    writer.classList.remove('is-formatting');
  });

  for (const b of formatBar.querySelectorAll('.fmt-btn')) {
    // Keep the keyboard up and the words selected while tapping a button.
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => {
      if (document.activeElement !== bodyInput) {
        bodyInput.focus({ preventScroll: true });
        if (savedRange) {
          const sel = getSelection();
          sel.removeAllRanges();
          sel.addRange(savedRange);
        }
      }
      document.execCommand(b.dataset.cmd, false);
      haptic();
      markEmpty();
      syncFormatBar();
      schedulePersist();
    });
  }

  // On phones the keyboard covers the bottom of the screen; keep the bar just above it.
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const place = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--keyboard-inset', `${covered}px`);
    };
    vv.addEventListener('resize', place);
    vv.addEventListener('scroll', place);
  }
  alignBtn.addEventListener('click', () => {
    setAlign(draft.align === 'left' ? 'center' : 'left');
    state.prefs.align = draft.align;
    persist();
    save();
  });
  publishBtn.addEventListener('click', () => {
    if (current && current.volumeId) closeWriter();
    else openPublish();
  });
  $('#placement-btn').addEventListener('click', openPublish);
  $('#publish-new').addEventListener('click', () => openVolumeEditor(null, { publish: true }));
  $('#unpublish-btn').addEventListener('click', unpublish);
  deleteBtn.addEventListener('click', deleteVerse);
  $('#writer-close').addEventListener('click', closeWriter);

  window.addEventListener('scroll', () => {
    $('#writer-bar').classList.toggle('is-scrolled', isWriting() && window.scrollY > 8);
  }, { passive: true });

  // Save immediately when the app is put away mid-sentence.
  const flush = () => { if (isWriting()) persist(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);

  /* ---------------- Sheets ---------------- */

  function closeDialogs() {
    for (const d of dialogs) if (d.open) d.close();
  }

  function openSheet(dialog) {
    closeDialogs();
    dialog.showModal();
    holdHistory();
  }

  // Tapping the dimmed area outside a sheet closes it.
  for (const d of dialogs) {
    // Let whatever opens next (another sheet, a volume) claim the history entry first.
    d.addEventListener('close', () => setTimeout(releaseHistory, 0));
    d.addEventListener('click', (e) => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) d.close();
    });
  }

  function ask(message, yesLabel) {
    const dialog = $('#confirm');
    $('#confirm-msg').textContent = message;
    $('#confirm-yes').textContent = yesLabel;
    dialog.returnValue = '';
    openSheet(dialog);
    return new Promise((resolve) => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'yes'), { once: true });
    });
  }
  $('#confirm-yes').addEventListener('click', () => $('#confirm').close('yes'));
  $('#confirm-no').addEventListener('click', () => $('#confirm').close('no'));

  if (framed) {
    for (const el of document.querySelectorAll('[data-needs]')) el.hidden = true;
  }

  // Settings

  const settingsForm = $('#settings-form');

  function openSettings() {
    $('#set-author').value = state.author;
    for (const name of ['font', 'paper', 'size']) {
      const input = settingsForm.querySelector(`input[name="${name}"][value="${state.prefs[name]}"]`);
      if (input) input.checked = true;
    }
    $('#backup-note').textContent = framed
      ? 'Backups work once Verse is installed on your phone.'
      : state.lastBackup
        ? `${backupAge(state.lastBackup)} Your verses live only on this device.`
        : 'Your verses live only on this device. Save a backup now and then.';
    openSheet($('#settings'));
  }

  for (const b of document.querySelectorAll('[data-open-settings]')) b.addEventListener('click', openSettings);

  settingsForm.addEventListener('input', (e) => {
    const { name, value } = e.target;
    if (name === 'author') state.author = value;
    else if (name in state.prefs) state.prefs[name] = value;
    save();
    applyPrefs();
    refreshUnderneath();
  });

  function refreshUnderneath() {
    if (view === 'volume') {
      renderBook();
      goTo(currentKey, false);
    } else {
      renderHome();
    }
  }

  // Volumes: create and edit

  let editing = null;
  let publishAfter = false;
  const volForm = $('#vol-form');

  $('#vol-covers').append(...Object.entries(BINDINGS).map(([key, b]) =>
    h('label', { title: b.label },
      h('input', { type: 'radio', name: 'binding', value: key, 'aria-label': b.label }),
      h('span', { class: 'mini-cover', style: coverStyle(key) }))));

  const chosenBinding = () => volForm.querySelector('input[name="binding"]:checked')?.value || 'oxblood';

  function nextBinding() {
    const used = new Set(state.volumes.map((v) => v.binding));
    const keys = Object.keys(BINDINGS);
    return keys.find((k) => !used.has(k)) || keys[state.volumes.length % keys.length];
  }

  function updatePreview() {
    const vol = { id: '', title: $('#vol-title').value.trim() || 'Untitled', binding: chosenBinding() };
    $('#vol-preview').replaceChildren(coverEl(vol, { badge: false }));
  }

  function openVolumeEditor(id, { publish = false } = {}) {
    editing = volumeById(id);
    publishAfter = publish;
    $('#vol-edit-title').textContent = editing ? 'This volume' : 'A new volume';
    $('#vol-title').value = editing ? editing.title : '';
    $('#vol-note').value = editing ? editing.note : '';
    const binding = editing ? editing.binding : nextBinding();
    volForm.querySelector(`input[name="binding"][value="${binding}"]`).checked = true;
    $('#vol-save').textContent = editing ? 'Save' : publish ? 'Create and publish' : 'Create volume';
    $('#vol-extra').hidden = !editing;
    updatePreview();
    openSheet($('#vol-edit'));
  }

  volForm.addEventListener('input', updatePreview);
  volForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('#vol-title').value.trim();
    if (!title) {
      $('#vol-title').focus();
      return;
    }
    const fields = { title, note: $('#vol-note').value.trim(), binding: chosenBinding(), updatedAt: nowISO() };
    const created = !editing;
    const vol = editing || { id: uid(), createdAt: fields.updatedAt };
    Object.assign(vol, fields);
    if (created) state.volumes.push(vol);
    save();
    const publish = publishAfter;
    editing = null;
    publishAfter = false;
    $('#vol-edit').close();
    if (publish && isWriting() && current) {
      publishTo(vol.id);
      return;
    }
    refreshUnderneath();
    toast(created ? `${title} is on your shelf` : 'Volume saved');
  });

  $('#vol-delete').addEventListener('click', async () => {
    const vol = editing;
    if (!vol) return;
    const n = versesIn(vol.id).length;
    const ok = await ask(
      `Delete the volume “${vol.title}”?${n ? ` Its ${countVerses(n)} stay in your journal.` : ''}`,
      'Delete volume',
    );
    if (!ok) return;
    for (const p of state.verses) {
      if (p.volumeId === vol.id) Object.assign(p, { volumeId: null, publishedAt: null });
    }
    state.volumes = state.volumes.filter((v) => v.id !== vol.id);
    delete ui.pages[vol.id];
    save();
    saveUI();
    if (view === 'volume' && openVol === vol.id) closeVolume();
    else renderHome();
    toast(n ? 'Volume deleted. Its verses are still in your journal.' : 'Volume deleted');
  });

  $('#vol-print').addEventListener('click', () => {
    const vol = editing;
    $('#vol-edit').close();
    if (vol) printVolume(vol);
  });

  /* ---------------- Backups ---------------- */

  function backupFile() {
    const data = { app: 'verse', format: 2, exportedAt: nowISO(), ...state };
    const day = nowISO().slice(0, 10);
    return new File([JSON.stringify(data, null, 2)], `verse-backup-${day}.json`, { type: 'application/json' });
  }

  function markBackedUp(where = '') {
    state.lastBackup = nowISO();
    save();
    closeDialogs();
    toast(`Backup saved${where}`);
  }

  async function exportBackup() {
    const file = backupFile();
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Verse backup' });
        markBackedUp();
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = h('a', { href: url, download: file.name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    markBackedUp(' to your Downloads');
  }

  $('#backup-btn').addEventListener('click', exportBackup);
  $('#restore-btn').addEventListener('click', () => $('#restore-input').click());

  $('#restore-input').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let incoming;
    try {
      const data = JSON.parse(await file.text());
      if (!data || (!Array.isArray(data.verses) && !Array.isArray(data.poems))) throw new Error('not a backup');
      incoming = normalise(data);
    } catch {
      toast('That file isn’t a Verse backup.');
      return;
    }
    // Merge rather than replace, so restoring never loses anything already here.
    let added = 0;
    for (const v of incoming.volumes) {
      const mine = volumeById(v.id);
      if (!mine) state.volumes.push(v);
      else if (v.updatedAt > mine.updatedAt) Object.assign(mine, v);
    }
    for (const p of incoming.verses) {
      const mine = state.verses.find((q) => q.id === p.id);
      if (!mine) {
        state.verses.push(p);
        added += 1;
      } else if (p.updatedAt > mine.updatedAt) {
        Object.assign(mine, p);
        added += 1;
      }
    }
    if (!state.author.trim()) state.author = incoming.author;
    state.welcomed = true;
    save();
    closeDialogs();
    refreshUnderneath();
    toast(added ? `Restored ${countVerses(added)}` : 'Everything in that backup is already here');
  });

  /* ---------------- Printing ---------------- */

  function buildPrintBook(vol) {
    const verses = versesIn(vol.id);
    const author = state.author.trim();
    const sheets = [
      h('section', { class: 'pb-page pb-cover' },
        h('h1', { class: 'vol-cover-title', text: vol.title }),
        h('div', { class: 'flourish' }),
        author ? h('p', { class: 'vol-cover-author', text: author }) : null,
        vol.note.trim() ? h('p', { class: 'vol-cover-note', text: vol.note.trim() }) : null,
      ),
    ];
    if (verses.length) {
      sheets.push(h('section', { class: 'pb-page' },
        h('h2', { class: 'page-heading', text: 'Contents' }),
        h('ol', { class: 'toc' }, verses.map((p, i) =>
          h('li', { class: 'toc-row' },
            h('span', { class: `toc-title${hasTitle(p) ? '' : ' is-first-line'}`, text: displayTitle(p) }),
            h('span', { class: 'toc-dots' }),
            h('span', { class: 'toc-num', text: String(i + 1) }),
          ),
        )),
      ));
    }
    verses.forEach((p, i) => sheets.push(
      h('section', { class: 'pb-page' },
        h('div', { class: `poem poem--${p.align}` },
          hasTitle(p) ? h('h2', { class: 'poem-title', text: p.title.trim() }) : h('div', { class: 'poem-mark', text: '*' }),
          h('p', { class: 'poem-body' }, richBody(p.body)),
        ),
        h('p', { class: 'pb-folio', text: String(i + 1) }),
      ),
    ));
    $('#print-book').replaceChildren(...sheets);
  }

  function printVolume(vol) {
    if (!versesIn(vol.id).length) {
      toast('Publish a verse to this volume first.');
      return;
    }
    buildPrintBook(vol);
    window.print();
  }
  window.addEventListener('beforeprint', () => {
    const vol = volumeById(openVol);
    if (vol) buildPrintBook(vol);
  });

  /* ---------------- Installing ---------------- */

  // Chrome on Android offers to install Verse as an app; keep the offer for our own button.
  let installOffer = null;
  const installed = () => window.matchMedia('(display-mode: standalone)').matches;

  function updateInstall() {
    $('#install-row').hidden = !installOffer;
    $('#install-card').hidden = !installOffer || ui.installLater === true;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    if (installed()) return;
    installOffer = e;
    updateInstall();
  });
  window.addEventListener('appinstalled', () => {
    installOffer = null;
    updateInstall();
    toast('Verse is installed. You’ll find it with your other apps.');
  });
  for (const b of document.querySelectorAll('[data-install]')) {
    b.addEventListener('click', async () => {
      if (!installOffer) return;
      const offer = installOffer;
      installOffer = null;
      closeDialogs();
      updateInstall();
      try { await offer.prompt(); } catch { /* ignore */ }
    });
  }
  $('#install-later').addEventListener('click', () => {
    ui.installLater = true;
    saveUI();
    updateInstall();
  });

  /* ---------------- First run ---------------- */

  function seedSamples() {
    const day = 86400000;
    const at = (daysAgo, hours = 0) => new Date(Date.now() - daysAgo * day + hours * 3600000).toISOString();
    const vol = (title, binding, note, daysAgo) =>
      ({ id: uid(), title, binding, note, createdAt: at(daysAgo), updatedAt: at(daysAgo) });
    const mornings = vol('Mornings', 'honey', 'Kettles, early light, first lines.', 60);
    const weather = vol('Weather', 'teal', 'Rain, mostly. Some sun.', 50);
    const summer = vol('Summer, Remembered', 'bottle', 'Places I keep going back to.', 45);
    state.volumes.push(mornings, weather, summer);
    const verse = (title, align, feeling, kind, daysAgo, volume, body) => ({
      id: uid(), title, body, fmt: 1, align, feeling, kind, createdAt: at(daysAgo), updatedAt: at(daysAgo),
      volumeId: volume ? volume.id : null, publishedAt: volume ? at(daysAgo, 1) : null,
    });
    state.verses.push(
      verse('Elm Street', 'center', 'wistful', 'memory', 30, summer,
        'My grandmother’s kitchen\nsmelled of bread and bleach,\nand the radio was always\na little too loud,\n\nas if she wanted the whole street\nto know\nthat someone in this house\nwas *still* singing.'),
      verse('Morning Pages', 'center', 'grateful', 'moment', 12, mornings,
        'The kettle knows\nbefore I do\nthat the day has started.\n\nI sit with the steam\nand the small loud quiet\nof a house still sleeping,\n\nand write one true line\nbefore the world\nasks me for anything.'),
      verse('', 'left', 'hopeful', 'thought', 8, weather,
        'Some days the words come\n    like weather,\n        all at once,\n            from everywhere.\n\nOther days I sit\nat the window\nand wait for a single drop.'),
      verse('Tide', 'center', 'tender', 'thought', 1, null,
        'You do not have to be\nthe whole ocean\ntoday.\n\nBe the tide.\nGo out a little.\nCome back.'),
    );
  }

  function welcome() {
    const dialog = $('#welcome');
    $('#welcome-preview').hidden = !framed;
    $('#welcome-volume-field').hidden = state.volumes.length > 0;
    $('#welcome-author').value = '';
    $('#welcome-volume').value = '';
    dialog.showModal();
    dialog.addEventListener('close', () => {
      const author = $('#welcome-author').value.trim();
      if (author) state.author = author;
      if (!state.volumes.length) {
        const stamp = nowISO();
        state.volumes.push({
          id: uid(), title: $('#welcome-volume').value.trim() || 'First Verses', note: '',
          binding: 'oxblood', createdAt: stamp, updatedAt: stamp,
        });
      }
      state.welcomed = true;
      save();
      renderHome();
      launch();
    }, { once: true });
  }

  // Opened from the "Write a verse" shortcut, or with text shared from another app.
  function launch() {
    const params = new URLSearchParams(location.search);
    const shared = ['title', 'text', 'url'].some((k) => params.get(k));
    if (!shared && !params.has('write')) return;
    if (!framed) history.replaceState(null, '', location.pathname);
    if (!shared) {
      openWriter();
      return;
    }
    const body = [params.get('text'), params.get('url')].filter(Boolean).join('\n');
    openWriter(null, { prefill: { title: body ? params.get('title') || '' : '', body: body || params.get('title') || '' } });
    toast('Saved in your journal');
  }

  /* ---------------- Keyboard ---------------- */

  // Android shrinks the page while the on-screen keyboard is up; notice it so the
  // tab bar can step aside. (Closing the keyboard doesn't always blur the field.)
  let fullHeight = window.innerHeight;
  function checkKeyboard() {
    fullHeight = Math.max(fullHeight, window.innerHeight);
    document.documentElement.classList.toggle('keyboard-open', window.innerHeight < fullHeight - 120);
  }
  window.addEventListener('resize', checkKeyboard);
  screen.orientation?.addEventListener('change', () => {
    fullHeight = 0;
    setTimeout(checkKeyboard, 300);
  });

  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return;
    if (isWriting()) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        publishBtn.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeWriter();
      }
      return;
    }
    if (view !== 'volume' || e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); turn(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1); }
    if (e.key === 'Escape') closeVolume();
  });

  // Another tab changed things: show the latest.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORE_KEY || isWriting()) return;
    state = load();
    applyPrefs();
    if (view === 'volume' && !volumeById(openVol)) closeVolume();
    else refreshUnderneath();
  });

  /* ---------------- Start ---------------- */

  if (framed && !state.welcomed && !state.verses.length) seedSamples();
  if (!['journal', 'shelf'].includes(ui.tab)) ui.tab = 'journal';
  applyPrefs();
  setView('home');
  renderHome();
  if (!state.welcomed) welcome();
  else launch();
  if (!storageOK && !framed) toast('This browser won’t let Verse save. Try opening it outside private browsing.');

  if ('serviceWorker' in navigator && !framed && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
