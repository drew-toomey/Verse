/* Verse — write free verse; each finished verse becomes the next page of your book. */
(() => {
  'use strict';

  const STORE_KEY = 'verse.book.v1';
  const PAGE_KEY = 'verse.page';
  const $ = (sel) => document.querySelector(sel);

  // The in-chat preview runs inside a sandboxed frame without downloads or printing.
  const framed = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  if (framed) document.documentElement.classList.add('is-framed');

  /* ---------------- Storage ---------------- */

  const nowISO = () => new Date().toISOString();

  function defaults() {
    return {
      book: { title: 'Verse', author: '', begun: nowISO() },
      prefs: { font: 'garamond', paper: 'sepia', size: 'm', align: 'center' },
      poems: [],
      welcomed: false,
      lastBackup: null,
    };
  }

  function cleanPoem(p) {
    const created = typeof p.createdAt === 'string' ? p.createdAt : nowISO();
    return {
      id: String(p.id),
      title: typeof p.title === 'string' ? p.title : '',
      body: typeof p.body === 'string' ? p.body : '',
      align: p.align === 'left' ? 'left' : 'center',
      createdAt: created,
      updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : created,
      boundAt: typeof p.boundAt === 'string' ? p.boundAt : null,
    };
  }

  function normalise(data) {
    const base = defaults();
    const d = data && typeof data === 'object' ? data : {};
    return {
      book: { ...base.book, ...(d.book || {}) },
      prefs: { ...base.prefs, ...(d.prefs || {}) },
      poems: Array.isArray(d.poems) ? d.poems.filter((p) => p && p.id).map(cleanPoem) : [],
      welcomed: Boolean(d.welcomed),
      lastBackup: typeof d.lastBackup === 'string' ? d.lastBackup : null,
    };
  }

  let storageOK = true;

  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORE_KEY);
    } catch {
      storageOK = false;
      return defaults();
    }
    if (!raw) return defaults();
    try {
      return normalise(JSON.parse(raw));
    } catch {
      // Never overwrite something we couldn't read; set it aside first.
      try { localStorage.setItem(`${STORE_KEY}.unreadable.${Date.now()}`, raw); } catch { /* ignore */ }
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

  function remember(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }
  function recall(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  let state = load();

  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

  const bound = () =>
    state.poems.filter((p) => p.boundAt).sort((a, b) => a.boundAt.localeCompare(b.boundAt));
  const loose = () =>
    state.poems.filter((p) => !p.boundAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

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
  const monthYear = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
  const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
  const shortDateYear = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  const fmtLong = (iso) => longDate.format(new Date(iso));
  function fmtShort(iso) {
    const d = new Date(iso);
    return (d.getFullYear() === new Date().getFullYear() ? shortDate : shortDateYear).format(d);
  }
  function fmtAgo(iso) {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return 'saved today';
    if (days === 1) return 'saved yesterday';
    if (days < 30) return `saved ${days} days ago`;
    return `last saved ${fmtShort(iso)}`;
  }

  function toRoman(n) {
    const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
      [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
    return out;
  }

  const plural = (n, one, many) => `${n === 1 ? 'One' : n} ${n === 1 ? one : many}`;
  const countVerses = (n) => (n === 1 ? '1 verse' : `${n} verses`);

  function firstLine(body) {
    const line = (body.split('\n').find((l) => l.trim()) || '').trim();
    return line.length > 52 ? `${line.slice(0, 50).trimEnd()}…` : line;
  }
  const hasTitle = (p) => Boolean(p.title.trim());
  const displayTitle = (p) => p.title.trim() || firstLine(p.body) || 'Untitled';
  const tidyBody = (body) => body.replace(/^\s*\n/, '').replace(/\s+$/, '');

  let toastTimer = 0;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
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

  /* ---------------- The book ---------------- */

  const book = $('#book');
  let currentKey = recall(PAGE_KEY) || 'cover';

  function page(key, cls, ...content) {
    return h('article', { class: `page ${cls}`, dataset: { key } }, h('div', { class: 'paper' }, ...content));
  }

  function coverPage(poems) {
    const title = state.book.title.trim() || 'Verse';
    const author = state.book.author.trim();
    return page('cover', 'page--cover',
      h('div', { class: 'cover' },
        h('h1', { class: `cover-title${title.length > 12 ? ' is-long' : ''}`, text: title }),
        h('div', { class: 'flourish', 'aria-hidden': 'true' }),
        author ? h('p', { class: 'cover-author', text: author }) : null,
      ),
      h('div', { class: 'cover-foot' },
        h('p', { class: 'cover-year', text: toRoman(new Date(state.book.begun).getFullYear()) }),
        poems.length
          ? [
            h('p', { class: 'cover-count', text: countVerses(poems.length) }),
            h('button', { class: 'link-btn', type: 'button', text: 'Turn the page', onclick: () => goTo('contents') }),
          ]
          : h('button', { class: 'link-btn', type: 'button', text: 'Write your first verse', onclick: () => openWriter() }),
      ),
    );
  }

  function contentsPage(poems) {
    const untitled = poems.some((p) => !hasTitle(p));
    return page('contents', 'page--contents',
      h('h2', { class: 'page-heading', text: 'Contents' }),
      h('ol', { class: 'toc' }, poems.map((p, i) =>
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
    return page(p.id, 'page--poem',
      h('div', { class: `poem poem--${p.align}` },
        hasTitle(p)
          ? h('h2', { class: 'poem-title', text: p.title.trim() })
          : h('div', { class: 'poem-mark', 'aria-hidden': 'true', text: '*' }),
        h('p', { class: 'poem-body', text: tidyBody(p.body) }),
      ),
      h('footer', { class: 'page-foot' },
        h('time', { datetime: p.createdAt, text: fmtLong(p.createdAt) }),
        h('span', { class: 'folio', 'aria-label': `Page ${n}`, text: String(n) }),
        h('button', { class: 'foot-btn', type: 'button', text: 'Edit', onclick: () => openWriter(p.id) }),
      ),
    );
  }

  function endPage(count) {
    const face = state.prefs.font === 'typewriter' ? 'Courier Prime' : 'EB Garamond';
    return page('end', 'page--end',
      h('div', { class: 'end' },
        h('div', { class: 'flourish', 'aria-hidden': 'true' }),
        h('p', { class: 'end-note', text: count ? 'The rest is unwritten.' : 'Your book is waiting for its first verse.' }),
        h('button', { class: 'pill-btn', type: 'button', text: count ? 'Write the next verse' : 'Write the first verse', onclick: () => openWriter() }),
      ),
      h('p', { class: 'colophon', text: `Set in ${face}. Begun in ${monthYear.format(new Date(state.book.begun))}. ${count ? `${plural(count, 'verse', 'verses')} so far.` : ''}`.trim() }),
    );
  }

  function renderBook() {
    const poems = bound();
    const pages = [coverPage(poems)];
    if (poems.length) pages.push(contentsPage(poems));
    poems.forEach((p, i) => pages.push(poemPage(p, i + 1)));
    pages.push(endPage(poems.length));
    book.replaceChildren(...pages);
    $('#title-btn').textContent = state.book.title.trim() || 'Verse';
    if (pageIndex(currentKey) < 0) currentKey = 'cover';
    updateTurns();
  }

  const pages = () => [...book.children];
  const pageIndex = (key) => pages().findIndex((el) => el.dataset.key === key);

  function goTo(key, smooth = true) {
    const i = Math.max(0, pageIndex(key));
    currentKey = pages()[i]?.dataset.key || 'cover';
    book.scrollTo({ left: i * book.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
    remember(PAGE_KEY, currentKey);
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
        remember(PAGE_KEY, currentKey);
        updateTurns();
      }
    }, 120);
  }, { passive: true });

  // Keep the same page in view when the phone rotates or the window resizes.
  new ResizeObserver(() => {
    if (book.clientWidth) book.scrollLeft = Math.max(0, pageIndex(currentKey)) * book.clientWidth;
  }).observe(book);

  $('#turn-prev').addEventListener('click', () => turn(-1));
  $('#turn-next').addEventListener('click', () => turn(1));
  $('#title-btn').addEventListener('click', () => goTo('cover'));

  /* ---------------- The writer ---------------- */

  const writer = $('#writer');
  const titleInput = $('#poem-title');
  const bodyInput = $('#poem-body');
  const alignBtn = $('#align-btn');
  const bindBtn = $('#bind-btn');
  const deleteBtn = $('#delete-btn');

  let current = null; // the poem object being edited, once it has been saved at least once
  let align = 'center';
  let saveTimer = 0;

  const isOpen = () => !writer.hidden;

  function growBody() {
    bodyInput.style.height = 'auto';
    bodyInput.style.height = `${bodyInput.scrollHeight}px`;
  }

  function setAlign(value) {
    align = value === 'left' ? 'left' : 'center';
    bodyInput.classList.toggle('is-left', align === 'left');
    alignBtn.setAttribute('aria-pressed', String(align === 'left'));
    alignBtn.setAttribute('aria-label', `Line alignment: ${align === 'left' ? 'left' : 'centred'}`);
  }

  function refreshWriterChrome() {
    const isBound = Boolean(current && current.boundAt);
    bindBtn.textContent = isBound ? 'Done' : 'Add to book';
    deleteBtn.hidden = !current;
    let status = 'New verse';
    if (isBound) status = `Page ${bound().findIndex((p) => p.id === current.id) + 1}`;
    else if (current) status = 'Loose page';
    $('#writer-status').textContent = status;

    const text = bodyInput.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    const lines = text ? text.split('\n').filter((l) => l.trim()).length : 0;
    const when = fmtLong(current ? current.createdAt : nowISO());
    $('#writer-meta').textContent = words
      ? `${when} · ${lines === 1 ? '1 line' : `${lines} lines`} · ${words === 1 ? '1 word' : `${words} words`}`
      : when;
  }

  function openWriter(id) {
    closeDialogs();
    current = id ? state.poems.find((p) => p.id === id) || null : null;
    titleInput.value = current ? current.title : '';
    bodyInput.value = current ? current.body : '';
    setAlign(current ? current.align : state.prefs.align);

    writer.hidden = false;
    document.body.classList.add('is-writing');
    window.scrollTo(0, 0);
    growBody();
    refreshWriterChrome();
    markHistory();
    if (!current) bodyInput.focus({ preventScroll: true });
  }

  function persist() {
    clearTimeout(saveTimer);
    const title = titleInput.value;
    const body = bodyInput.value;
    if (!current) {
      if (!title.trim() && !body.trim()) return;
      const stamp = nowISO();
      current = { id: uid(), title, body, align, createdAt: stamp, updatedAt: stamp, boundAt: null };
      state.poems.push(current);
    } else if (current.title === title && current.body === body && current.align === align) {
      return;
    } else {
      Object.assign(current, { title, body, align, updatedAt: nowISO() });
    }
    save();
  }

  function schedulePersist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { persist(); refreshWriterChrome(); }, 450);
  }

  function hideWriter() {
    if (!isOpen()) return;
    titleInput.blur();
    bodyInput.blur();
    writer.hidden = true;
    document.body.classList.remove('is-writing');
    if (!framed && history.state?.verse === 'writer') history.back();
  }

  // An extra history entry lets the phone's back gesture close the writer.
  function markHistory() {
    if (!framed && history.state?.verse !== 'writer') history.pushState({ verse: 'writer' }, '');
  }

  function removePoem(id) {
    state.poems = state.poems.filter((p) => p.id !== id);
    save();
  }

  // Leave the writer, keeping whatever was written as a loose page.
  function closeWriter() {
    if (!isOpen()) return;
    persist();
    if (current && current.boundAt && !current.body.trim()) {
      toast('A page needs at least one line. Delete it instead?');
      bodyInput.focus();
      markHistory();
      return;
    }
    let message = '';
    if (current && !current.boundAt) {
      if (!current.title.trim() && !current.body.trim()) removePoem(current.id);
      else message = 'Kept with your loose pages';
    }
    const returnTo = current && current.boundAt ? current.id : currentKey;
    current = null;
    hideWriter();
    renderBook();
    goTo(returnTo, false);
    if (message) toast(message);
  }

  function bindVerse() {
    persist();
    if (!bodyInput.value.trim()) {
      refreshWriterChrome();
      toast('Write a line or two first.');
      bodyInput.focus();
      return;
    }
    const wasBound = Boolean(current.boundAt);
    if (!wasBound) {
      current.boundAt = nowISO();
      save();
      requestPersistence();
    }
    const id = current.id;
    const n = bound().findIndex((p) => p.id === id) + 1;
    current = null;
    hideWriter();
    renderBook();
    goTo(id, false);
    if (!wasBound) {
      book.children[pageIndex(id)]?.querySelector('.paper')?.classList.add('is-new');
      toast(`Added to your book as page ${n}`);
    }
  }

  async function deleteVerse() {
    if (!current) return;
    persist();
    const ok = await ask(
      current.boundAt ? 'Remove this verse from your book? This can’t be undone.' : 'Delete this loose page? This can’t be undone.',
      'Delete',
    );
    if (!ok || !current) return;
    removePoem(current.id);
    current = null;
    hideWriter();
    renderBook();
    goTo(currentKey, false);
    toast('Verse deleted');
  }

  titleInput.addEventListener('input', schedulePersist);
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      bodyInput.focus();
    }
  });
  bodyInput.addEventListener('input', () => { growBody(); schedulePersist(); });
  alignBtn.addEventListener('click', () => {
    setAlign(align === 'left' ? 'center' : 'left');
    state.prefs.align = align;
    persist();
    save();
  });
  bindBtn.addEventListener('click', bindVerse);
  deleteBtn.addEventListener('click', deleteVerse);
  $('#writer-close').addEventListener('click', closeWriter);
  $('#write-btn').addEventListener('click', () => openWriter());

  window.addEventListener('scroll', () => {
    $('#writer-bar').classList.toggle('is-scrolled', isOpen() && window.scrollY > 8);
  }, { passive: true });

  // The phone's back gesture (or button) closes the writer instead of leaving the app.
  window.addEventListener('popstate', () => { if (isOpen()) closeWriter(); });

  // Save immediately when the app is put away mid-sentence.
  const flush = () => { if (isOpen()) persist(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);

  /* ---------------- Dialogs ---------------- */

  const dialogs = ['#menu', '#drafts', '#settings', '#confirm'].map((s) => $(s));

  function closeDialogs() {
    for (const d of dialogs) if (d.open) d.close();
  }

  function openSheet(dialog) {
    closeDialogs();
    dialog.showModal();
  }

  // Tapping the dimmed area outside a sheet closes it.
  for (const d of dialogs) {
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
    dialog.showModal();
    return new Promise((resolve) => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'yes'), { once: true });
    });
  }
  $('#confirm-yes').addEventListener('click', () => $('#confirm').close('yes'));
  $('#confirm-no').addEventListener('click', () => $('#confirm').close('no'));

  // Menu

  function renderMenu() {
    const n = bound().length;
    const d = loose().length;
    $('#menu-title').textContent = state.book.title.trim() || 'Verse';
    $('#menu-count').textContent = n ? countVerses(n) : 'empty so far';
    $('#menu-drafts').textContent = d ? `${d} unfinished` : 'none';
    $('#menu-backup').textContent = state.lastBackup ? fmtAgo(state.lastBackup) : 'never saved';
    $('#menu-note').textContent = framed
      ? 'This is a preview. Install Verse on your phone to keep your verses and make backups.'
      : 'Your verses are kept on this device only. Save a backup now and then.';
  }

  $('#menu-btn').addEventListener('click', () => {
    renderMenu();
    openSheet($('#menu'));
  });

  $('#menu').addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    $('#menu').close();
    if (action === 'contents') goTo(bound().length ? 'contents' : 'cover');
    if (action === 'drafts') openDrafts();
    if (action === 'settings') openSettings();
    if (action === 'backup') exportBackup();
    if (action === 'restore') $('#restore-input').click();
    if (action === 'print') printBook();
  });

  if (framed) {
    for (const el of document.querySelectorAll('[data-needs="files"], [data-needs="print"]')) el.hidden = true;
  }

  // Loose pages

  function openDrafts() {
    const list = loose();
    $('#drafts-empty').hidden = list.length > 0;
    $('#draft-list').replaceChildren(...list.map((p) =>
      h('li', {},
        h('button', { class: 'draft-row', type: 'button', onclick: () => openWriter(p.id) },
          h('span', { class: `draft-title${hasTitle(p) ? '' : ' is-first-line'}`, text: displayTitle(p) }),
          h('span', { class: 'draft-date', text: fmtShort(p.updatedAt) }),
          h('span', { class: 'draft-snippet', text: hasTitle(p) ? firstLine(p.body) || 'No lines yet' : 'Untitled' }),
        ),
      ),
    ));
    openSheet($('#drafts'));
  }

  // Book settings

  const settingsForm = $('#settings-form');

  function openSettings() {
    $('#set-title').value = state.book.title;
    $('#set-author').value = state.book.author;
    for (const name of ['font', 'paper', 'size']) {
      const input = settingsForm.querySelector(`input[name="${name}"][value="${state.prefs[name]}"]`);
      if (input) input.checked = true;
    }
    openSheet($('#settings'));
  }

  settingsForm.addEventListener('input', (e) => {
    const { name, value } = e.target;
    if (name === 'title' || name === 'author') state.book[name] = value;
    else if (name in state.prefs) state.prefs[name] = value;
    save();
    applyPrefs();
    renderBook();
    goTo(currentKey, false);
  });

  /* ---------------- Backups ---------------- */

  function backupFile() {
    const data = { app: 'verse', format: 1, exportedAt: nowISO(), ...state };
    const day = nowISO().slice(0, 10);
    return new File([JSON.stringify(data, null, 2)], `verse-backup-${day}.json`, { type: 'application/json' });
  }

  function markBackedUp() {
    state.lastBackup = nowISO();
    save();
    toast('Backup saved');
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
    markBackedUp();
  }

  $('#restore-input').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let incoming;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.poems)) throw new Error('not a backup');
      incoming = normalise(data);
    } catch {
      toast('That file isn’t a Verse backup.');
      return;
    }
    // Merge rather than replace, so restoring never loses anything already here.
    const hadPoems = bound().length > 0;
    let added = 0;
    for (const p of incoming.poems) {
      const mine = state.poems.find((q) => q.id === p.id);
      if (!mine) {
        state.poems.push(p);
        added += 1;
      } else if (p.updatedAt > mine.updatedAt) {
        Object.assign(mine, p);
        added += 1;
      }
    }
    if (!hadPoems) state.book = incoming.book;
    state.welcomed = true;
    save();
    renderBook();
    goTo('cover', false);
    toast(added ? `Restored ${countVerses(added)}` : 'Everything in that backup is already here');
  });

  /* ---------------- Printing ---------------- */

  function buildPrintBook() {
    const poems = bound();
    const title = state.book.title.trim() || 'Verse';
    const sheets = [
      h('section', { class: 'pb-page pb-cover' },
        h('h1', { class: 'cover-title', text: title }),
        h('div', { class: 'flourish' }),
        state.book.author.trim() ? h('p', { class: 'cover-author', text: state.book.author.trim() }) : null,
      ),
    ];
    if (poems.length) {
      sheets.push(h('section', { class: 'pb-page' },
        h('h2', { class: 'page-heading', text: 'Contents' }),
        h('ol', { class: 'toc' }, poems.map((p, i) =>
          h('li', { class: 'toc-row' },
            h('span', { class: `toc-title${hasTitle(p) ? '' : ' is-first-line'}`, text: displayTitle(p) }),
            h('span', { class: 'toc-dots' }),
            h('span', { class: 'toc-num', text: String(i + 1) }),
          ),
        )),
      ));
    }
    poems.forEach((p, i) => sheets.push(
      h('section', { class: 'pb-page' },
        h('div', { class: `poem poem--${p.align}` },
          hasTitle(p) ? h('h2', { class: 'poem-title', text: p.title.trim() }) : h('div', { class: 'poem-mark', text: '*' }),
          h('p', { class: 'poem-body', text: tidyBody(p.body) }),
        ),
        h('p', { class: 'pb-folio', text: String(i + 1) }),
      ),
    ));
    $('#print-book').replaceChildren(...sheets);
  }

  function printBook() {
    if (!bound().length) {
      toast('Add a verse to your book first.');
      return;
    }
    buildPrintBook();
    window.print();
  }
  window.addEventListener('beforeprint', buildPrintBook);

  /* ---------------- First run ---------------- */

  const SAMPLES = [
    {
      title: 'Morning Pages',
      align: 'center',
      body: 'The kettle knows\nbefore I do\nthat the day has started.\n\nI sit with the steam\nand the small loud quiet\nof a house still sleeping,\n\nand write one true line\nbefore the world\nasks me for anything.',
    },
    {
      title: '',
      align: 'left',
      body: 'Some days the words come\n    like weather,\n        all at once,\n            from everywhere.\n\nOther days I sit\nat the window\nand wait for a single drop.',
    },
    {
      title: 'Tide',
      align: 'center',
      body: 'You do not have to be\nthe whole ocean\ntoday.\n\nBe the tide.\nGo out a little.\nCome back.',
    },
  ];

  function seedSamples() {
    const start = Date.now() - SAMPLES.length * 86400000;
    SAMPLES.forEach((s, i) => {
      const stamp = new Date(start + i * 86400000).toISOString();
      state.poems.push({ id: uid(), ...s, createdAt: stamp, updatedAt: stamp, boundAt: stamp });
    });
  }

  function welcome() {
    const dialog = $('#welcome');
    $('#welcome-preview').hidden = !framed;
    $('#welcome-book').value = '';
    $('#welcome-author').value = '';
    dialog.showModal();
    dialog.addEventListener('close', () => {
      const title = $('#welcome-book').value.trim();
      const author = $('#welcome-author').value.trim();
      if (title) state.book.title = title;
      if (author) state.book.author = author;
      state.welcomed = true;
      save();
      renderBook();
      goTo('cover', false);
    }, { once: true });
  }

  function requestPersistence() {
    try { navigator.storage?.persist?.().catch(() => {}); } catch { /* ignore */ }
  }

  /* ---------------- Keyboard ---------------- */

  document.addEventListener('keydown', (e) => {
    if (isOpen()) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); bindVerse(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeWriter(); }
      return;
    }
    if (document.querySelector('dialog[open]') || e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); turn(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1); }
  });

  // Another tab changed the book: show the latest.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORE_KEY || isOpen()) return;
    state = load();
    applyPrefs();
    renderBook();
    goTo(currentKey, false);
  });

  /* ---------------- Start ---------------- */

  if (framed && !state.welcomed && !state.poems.length) seedSamples();
  applyPrefs();
  renderBook();
  goTo(currentKey, false);
  if (!state.welcomed) welcome();
  if (!storageOK && !framed) toast('This browser won’t let Verse save. Try opening it outside private browsing.');

  if ('serviceWorker' in navigator && !framed && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
