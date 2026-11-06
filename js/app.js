import { CONFIG } from './config.js';
import { PRESET_BOOKS, JA_CHAR_PRESETS } from './books-db.js';
import { loadState, saveLocal, uid, DriveSync } from './storage.js';
import { searchCoverStrict, searchPresets, searchGoogleBooks, lookupIsbn, findPresetByTitle, fetchPresetCover, cachedCover, amazonUrl, rakutenUrl } from './books.js';
import { IsbnScanner } from './scanner.js';
import { renderShareImage, canvasToFile } from './share.js';

// ---------------- 状態 ----------------
let state = loadState();
const today = new Date();
let viewY = today.getFullYear(), viewM = today.getMonth(); // 0-11
let editing = null;     // 編集中のログ
let picked = null;      // 選択中の本 {title, author, cover, isbn, lang, count, pid}

const $ = (s) => document.querySelector(s);
const fmt = (n) => Math.round(n || 0).toLocaleString('ja-JP');
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

const sync = new DriveSync(updateSyncUi);
const getState = () => state;
const setState = (s) => { state = s; saveLocal(state); render(); };

function commit() {
  saveLocal(state);
  render();
  sync.schedule(getState, setState);
}

// ---------------- 集計 ----------------
const children = () => state.children.filter((c) => !c.deleted);
const activeChild = () => {
  const a = state.settings.activeChild;
  if (a !== 'all' && !children().some((c) => c.id === a)) return children().length === 1 ? children()[0].id : 'all';
  return children().length === 1 ? children()[0].id : a;
};
const logsFor = (cid = activeChild()) => state.logs.filter((l) => !l.deleted && (cid === 'all' || l.childId === cid));

function aggregate(logs) {
  const r = { en: 0, jaBooks: 0, jaChars: 0, enBooks: 0 };
  for (const l of logs) {
    const t = l.times || 1;
    if (l.lang === 'en') { r.en += (l.count || 0) * t; r.enBooks += t; }
    else { r.jaBooks += t; r.jaChars += (l.count || 0) * t; }
  }
  return r;
}

function byDay(logs) {
  const m = new Map();
  for (const l of logs) {
    if (!m.has(l.date)) m.set(l.date, []);
    m.get(l.date).push(l);
  }
  return m;
}

function streak(logs) {
  const days = new Set(logs.map((l) => l.date));
  const d = new Date();
  if (!days.has(ymd(d))) d.setDate(d.getDate() - 1); // 今日まだでも昨日まで続いていればOK
  let n = 0;
  while (days.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------------- 描画 ----------------
function render() {
  renderTabs();
  renderStats();
  renderCalendar();
  renderReco();
}

function renderTabs() {
  const cs = children();
  const el = $('#childTabs');
  if (cs.length <= 1) { el.innerHTML = ''; return; }
  const a = activeChild();
  el.innerHTML = `<button data-c="all" class="${a === 'all' ? 'on' : ''}">👨‍👩‍👧 みんな</button>` +
    cs.map((c) => `<button data-c="${c.id}" class="${a === c.id ? 'on' : ''}">${esc(c.emoji)} ${esc(c.name)}</button>`).join('');
}

function renderStats() {
  const logs = logsFor();
  const mPrefix = `${viewY}-${pad(viewM + 1)}`;
  const month = aggregate(logs.filter((l) => l.date.startsWith(mPrefix)));
  const all = aggregate(logs);
  const st = streak(logs);
  $('#stats').innerHTML = `
    <div class="stat en"><div class="lbl">${viewM + 1}月の英語</div><div class="val">${fmt(month.en)}<small>語</small></div></div>
    <div class="stat ja"><div class="lbl">${viewM + 1}月の日本語</div><div class="val">${fmt(month.jaBooks)}<small>冊</small></div><div class="muted small">${month.jaChars ? '約' + fmt(month.jaChars) + '字' : '&nbsp;'}</div></div>
    <div class="stat"><div class="lbl">連続記録</div><div class="val">${st}<small>日</small> ${st >= 3 ? '🔥' : ''}</div></div>
    <div class="stat"><div class="lbl">英語の累計</div><div class="val">${fmt(all.en)}<small>語</small></div></div>`;
}

const shortNum = (n) => n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + '万' : fmt(n);

function renderCalendar() {
  $('#monthLabel').textContent = `${viewY}年 ${viewM + 1}月`;
  const first = new Date(viewY, viewM, 1).getDay();
  const days = new Date(viewY, viewM + 1, 0).getDate();
  const map = byDay(logsFor());
  const tStr = todayStr();
  let html = '';
  for (let i = 0; i < first; i++) html += '<div class="day empty"></div>';
  for (let d = 1; d <= days; d++) {
    const ds = `${viewY}-${pad(viewM + 1)}-${pad(d)}`;
    const a = aggregate(map.get(ds) || []);
    const has = a.en || a.jaBooks;
    html += `<button class="day ${has ? 'has' : ''} ${ds === tStr ? 'today' : ''} ${ds > tStr ? 'future' : ''}" data-date="${ds}">
      <span class="d">${d}</span>
      ${a.en ? `<span class="w">${shortNum(a.en)}</span>` : ''}
      ${a.jaBooks ? `<span class="b">${a.jaBooks}冊</span>` : ''}
    </button>`;
  }
  $('#calGrid').innerHTML = html;
  const m = aggregate(logsFor().filter((l) => l.date.startsWith(`${viewY}-${pad(viewM + 1)}`)));
  const readDays = [...map.keys()].filter((k) => k.startsWith(`${viewY}-${pad(viewM + 1)}`)).length;
  $('#monthSum').innerHTML = `<span class="en">英語 ${fmt(m.en)}語（${fmt(m.enBooks)}冊）</span><span class="ja">日本語 ${fmt(m.jaBooks)}冊</span><span>📅 ${readDays}日読んだ</span>`;
}

// ---------------- おすすめ ----------------
// 英語：最近読んだ英語の本のレベル平均から「同じくらい」4冊＋「少し上」4冊
// 日本語：最近読んだ日本語の本の文字数から「同じくらい」4冊＋「少し長め」4冊
let recoLang = 'en';

function pickBooks(cands, scoreFn, n, used) {
  const out = [];
  for (const { b, s } of cands.map((b) => ({ b, s: scoreFn(b) })).filter((x) => x.s != null).sort((x, y) => x.s - y.s)) {
    const key = b.series || b.pid;
    if (used.has(key) || used.has(b.pid)) continue;
    used.add(key); used.add(b.pid); out.push(b);
    if (out.length >= n) break;
  }
  return out;
}

function renderReco() {
  const logs = logsFor().slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const readPids = new Set(logs.map((l) => l.pid).filter(Boolean));
  const readTitles = new Set(logs.map((l) => l.title));
  const recent = logs.filter((l) => l.lang === recoLang).slice(0, 15);
  const preset = (l) => PRESET_BOOKS.find((b) => b.pid === l.pid);
  const recentSeries = new Set(recent.map((l) => preset(l)?.series).filter(Boolean));
  const cands = PRESET_BOOKS.filter((b) => b.lang === recoLang && !readPids.has(b.pid) && !readTitles.has(b.title) && !/平均/.test(b.title));
  // 表紙が出なかった本は順位を下げる（外しはしない）。表紙が出た本はわずかに優先
  const coverScore = (b) => (coverMissed(b.pid) ? 0.6 : coverStatus[b.pid] === 1 ? -0.05 : 0);
  const bonus = (b) => (recentSeries.has(b.series) ? -0.2 : 0) + (/1冊/.test(b.title) ? 0.3 : 0) + coverScore(b);
  const used = new Set();
  let same, up, note;

  if (recoLang === 'en') {
    const levels = recent.map((l) => preset(l)?.lv ?? estimateLevel(l.count)).filter((v) => v != null);
    const avg = levels.length ? levels.reduce((s, v) => s + v, 0) / levels.length : null;
    const base = avg ?? 0.3;
    same = pickBooks(cands, (b) => (Math.abs(b.lv - base) <= 0.5 ? Math.abs(b.lv - base) + bonus(b) : null), 4, used);
    up = pickBooks(cands, (b) => (b.lv > base + 0.2 && b.lv <= base + 1.5 ? Math.abs(b.lv - (base + 0.7)) + bonus(b) : null), 4, used);
    // 足りない時は条件をゆるめて補う
    if (same.length < 4) same.push(...pickBooks(cands, (b) => Math.abs(b.lv - base), 4 - same.length, used));
    if (up.length < 4) up.push(...pickBooks(cands, (b) => (b.lv > base ? b.lv - base : null), 4 - up.length, used));
    note = avg == null ? 'まだ英語の記録がないので、はじめての1冊におすすめの本を選びました。'
      : `最近読んでいる英語の本のレベル（目安 ${avg.toFixed(1)}）をもとに選びました。`;
  } else {
    const chars = recent.map((l) => l.count || preset(l)?.count).filter((v) => v > 0);
    const avg = chars.length ? chars.reduce((s, v) => s + v, 0) / chars.length : null;
    const base = avg ?? 300;
    const dist = (b, target) => Math.abs(Math.log(b.count / target));
    same = pickBooks(cands, (b) => (b.count >= base / 2.5 && b.count <= base * 2 ? dist(b, base) + bonus(b) : null), 4, used);
    up = pickBooks(cands, (b) => (b.count > base * 1.5 && b.count <= base * 8 ? dist(b, base * 3) + bonus(b) : null), 4, used);
    if (same.length < 4) same.push(...pickBooks(cands, (b) => dist(b, base), 4 - same.length, used));
    if (up.length < 4) up.push(...pickBooks(cands, (b) => (b.count > base ? dist(b, base * 3) : null), 4 - up.length, used));
    note = avg == null ? 'まだ日本語の記録がないので、小さい子に人気の絵本を選びました。'
      : `最近読んでいる日本語の本の長さ（約${fmt(avg)}字）をもとに選びました。`;
  }

  $('#recoNote').textContent = note;
  $('#recoSame').innerHTML = same.map(recoCard).join('');
  $('#recoUp').innerHTML = up.map(recoCard).join('') || '<p class="muted small">今のところ、これより上のおすすめはありません。</p>';
  [...same, ...up].forEach((b) => {
    if (cachedCover(b.pid) !== undefined) return;
    fetchPresetCover(b).then((url) => {
      if (!url) { markCover(b.pid, 0); return; }
      document.querySelectorAll(`.reco-img[data-pid="${b.pid}"]`).forEach((el) => { el.innerHTML = recoCover(url, b); });
    });
  });
}

function recoCard(b) {
  const unit = b.lang === 'en' ? '語' : '字';
  return `
    <div class="reco">
      <a class="reco-img" href="${esc(amazonUrl(b))}" target="_blank" rel="noopener sponsored" data-pid="${b.pid}">${recoCover(cachedCover(b.pid), b)}</a>
      <div class="t">${esc(b.title)}</div>
      <div class="why">約${fmt(b.count)}${unit}・${esc(b.series || b.author)}</div>
      <div class="links">
        <a class="btn amazon" href="${esc(amazonUrl(b))}" target="_blank" rel="noopener sponsored">Amazon</a>
        <a class="btn rakuten" href="${esc(rakutenUrl(b))}" target="_blank" rel="noopener sponsored">楽天</a>
      </div>
    </div>`;
}

// おすすめ用の大きい表紙（画像がなければ本の形のカードにタイトルを表示）
function recoCover(url, b) {
  const ph = `<span class="ph ${b.lang}"><span>${esc(b.series || b.title.replace(/[（(].*?[)）]/g, ''))}</span></span>`;
  if (!url && cachedCover(b.pid) === '') markCover(b.pid, 0);
  return url ? coverImg(url, ph, b.title, b.pid) : ph;
}

// 表紙画像：url は「候補1|候補2|…」。読み込めない・極小（画像なしの代わり画像）なら次の候補へ
function coverImg(url, fallbackHtml, alt, pid = '') {
  const [first, ...rest] = String(url).split('|');
  return `<img src="${esc(first)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer"
    data-alt="${esc(rest.join('|'))}" data-ph="${esc(fallbackHtml)}" data-pid="${esc(pid)}"
    onerror="coverNext(this)" onload="if(this.naturalWidth<40||this.naturalHeight<40)coverNext(this);else coverOk(this)">`;
}

// 表紙が出た本(1)・出なかった本(0)をこの端末に記録（おすすめで表紙のある本を優先するため）
const COVER_STATUS_KEY = 'tadoku-cover-status';
let coverStatus = {};
try { coverStatus = JSON.parse(localStorage.getItem(COVER_STATUS_KEY) || '{}'); } catch { coverStatus = {}; }
// 値：1＝表紙あり／それ以外の数字＝表紙が出なかった日時（7日たったら忘れて再挑戦）
const coverMissed = (pid) => coverStatus[pid] > 1 && Date.now() - coverStatus[pid] < 7 * 24 * 3600 * 1000;
function markCover(pid, ok) {
  if (!pid) return;
  if (ok && coverStatus[pid] === 1) return;
  if (!ok && coverMissed(pid)) return;
  coverStatus[pid] = ok ? 1 : Date.now();
  try { localStorage.setItem(COVER_STATUS_KEY, JSON.stringify(coverStatus)); } catch { /* 保存できなくても表示は続ける */ }
}
window.coverOk = (img) => markCover(img.dataset.pid, 1);
window.coverNext = (img) => {
  const rest = (img.dataset.alt || '').split('|').filter(Boolean);
  if (!rest.length) { markCover(img.dataset.pid, 0); img.outerHTML = img.dataset.ph; return; }
  img.dataset.alt = rest.slice(1).join('|');
  if (rest[0].startsWith('search:')) {
    // 最後の手段：Google Books で表紙を探す
    searchCoverStrict(rest[0].slice(7)).then((url) => {
      if (!img.isConnected) return;
      if (url) img.src = url; else window.coverNext(img);
    });
  } else img.src = rest[0];
};

function estimateLevel(words) {
  if (!words) return null;
  if (words < 100) return 0.2; if (words < 300) return 0.6; if (words < 800) return 1.0;
  if (words < 2000) return 1.6; if (words < 6000) return 2.6; if (words < 15000) return 3.8;
  if (words < 40000) return 5.5; return 7;
}

function coverInner(url, lang) {
  const icon = lang === 'ja' ? '📕' : '📘';
  return url ? coverImg(url, icon, '') : icon;
}
function loadCoverInto(book, el) {
  if (!el || cachedCover(book.pid) !== undefined) return;
  fetchPresetCover(book).then((url) => { if (url && el.isConnected) el.innerHTML = coverInner(url, book.lang); });
}

// ---------------- 日別ダイアログ ----------------
let dayOpen = null, dayOpenLast = null;
function openDay(date) {
  dayOpen = date; dayOpenLast = date;
  const [y, m, d] = date.split('-').map(Number);
  const w = '日月火水木金土'[new Date(y, m - 1, d).getDay()];
  $('#dayTitle').textContent = `${m}月${d}日（${w}）`;
  renderDay();
  $('#dayDlg').showModal();
}
function renderDay() {
  if (!dayOpen) return;
  const logs = logsFor().filter((l) => l.date === dayOpen);
  const a = aggregate(logs);
  $('#daySum').innerHTML = logs.length ? `<span class="en">英語 ${fmt(a.en)}語</span><span class="ja">日本語 ${a.jaBooks}冊${a.jaChars ? '（約' + fmt(a.jaChars) + '字）' : ''}</span>` : '<span class="muted">まだ記録がありません</span>';
  const multi = children().length > 1;
  $('#dayList').innerHTML = logs.map((l) => {
    const c = multi ? children().find((x) => x.id === l.childId) : null;
    const t = l.times || 1;
    const n = l.lang === 'en' ? `${fmt(l.count * t)}語` : `${t}冊${l.count ? '・約' + fmt(l.count * t) + '字' : ''}`;
    return `<button class="item" data-log="${l.id}">
      <div class="cover">${coverInner(l.cover, l.lang)}</div>
      <div class="grow"><div class="t"><span class="tag ${l.lang}">${l.lang === 'en' ? '英' : '日'}</span>${esc(l.title)}</div>
      <div class="a">${c ? esc(c.emoji + ' ' + c.name) + '・' : ''}${t > 1 ? t + '回読んだ・' : ''}タップで編集</div></div>
      <div class="n ${l.lang}">${n}</div></button>`;
  }).join('');
}

// ---------------- 追加ダイアログ ----------------
let addDate = null;
function openAdd(date = null, log = null) {
  editing = log;
  addDate = date || (log?.date) || todayStr();
  $('#searchInput').value = '';
  if (log) {
    picked = { title: log.title, author: log.author, cover: log.cover, isbn: log.isbn, lang: log.lang, count: log.count, pid: log.pid };
    showForm();
  } else {
    picked = null;
    showSearch();
    renderSearchEmpty();
  }
  if (!$('#addDlg').open) $('#addDlg').showModal();
  if (!log) setTimeout(() => $('#searchInput').focus({ preventScroll: true }), 50);
}

function showSearch() {
  $('#addTitle').textContent = '読んだ本を記録';
  $('#addSearchView').hidden = false; $('#bookForm').hidden = true;
}

function renderSearchEmpty() {
  itemIdx = 0;
  // 最近読んだ本（再読用）
  const seen = new Set(), recent = [];
  for (const l of logsFor().slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))) {
    if (seen.has(l.title)) continue;
    seen.add(l.title); recent.push(l);
    if (recent.length >= 8) break;
  }
  const popular = ['Oxford Reading Tree Stage 1+（1冊）', 'Brown Bear, Brown Bear, What Do You See?', 'The Very Hungry Caterpillar', 'Elephant & Piggie（1冊・平均）', 'Frog and Toad Are Friends', 'Magic Tree House #1 Dinosaurs Before Dark']
    .map((t) => PRESET_BOOKS.find((b) => b.title === t)).filter(Boolean);
  let html = '';
  if (recent.length) {
    html += '<div class="res-label">🔁 最近読んだ本（もう一度読んだ時に）</div>' +
      recent.map((l) => itemHtml({ title: l.title, author: l.author, cover: l.cover, lang: l.lang, count: l.count, isbn: l.isbn, pid: l.pid, exact: true }, 'r')).join('');
  }
  html += '<div class="res-label">⭐ 人気の本</div>' + popular.map((b) => itemHtml(b, 'p')).join('');
  setResults(html, [...recent.map((l) => ({ title: l.title, author: l.author, cover: l.cover, lang: l.lang, count: l.count, isbn: l.isbn, pid: l.pid, exact: true })), ...popular]);
}

let resultBooks = [];
function setResults(html, books) {
  resultBooks = books;
  $('#searchResults').innerHTML = html;
  $('#searchResults').querySelectorAll('.item').forEach((el) => {
    const b = resultBooks[+el.dataset.i];
    if (b?.pid && !b.cover) loadCoverInto(b, el.querySelector('.cover'));
  });
}

let itemIdx = 0;
function itemHtml(b) {
  const i = itemIdx++;
  const cover = b.cover || (b.pid ? cachedCover(b.pid) : '');
  const approx = b.pid && !b.exact ? '約' : '';
  const n = b.count ? (b.lang === 'en' ? `${approx}${fmt(b.count)}語` : `${approx}${fmt(b.count)}字`) : (b.lang === 'en' ? '語数？' : '');
  return `<button class="item" data-i="${i}">
    <div class="cover">${coverInner(cover, b.lang)}</div>
    <div class="grow"><div class="t"><span class="tag ${b.lang}">${b.lang === 'en' ? '英' : '日'}</span>${esc(b.title)}</div><div class="a">${esc(b.author || '')}</div></div>
    <div class="n ${b.lang}">${n}</div></button>`;
}

let searchCtl = null, searchTimer = null;
function onSearch() {
  const q = $('#searchInput').value.trim();
  clearTimeout(searchTimer);
  searchCtl?.abort();
  if (!q) { itemIdx = 0; renderSearchEmpty(); return; }
  itemIdx = 0;
  const presets = searchPresets(q, 15);
  const base = presets.length ? '<div class="res-label">📚 登録済みの本（語数つき）</div>' + presets.map(itemHtml).join('') : '';
  setResults(base + '<div class="res-label">🔎 ほかの本を検索中…</div>', [...presets]);
  searchTimer = setTimeout(async () => {
    searchCtl = new AbortController();
    try {
      const web = await searchGoogleBooks(q, searchCtl.signal);
      const seen = new Set(presets.map((p) => p.title.toLowerCase()));
      const extra = web.filter((b) => !seen.has(b.title.toLowerCase())).map((b) => {
        const p = findPresetByTitle(b.title);
        return p ? { ...b, count: p.count, pid: p.pid, lang: p.lang } : b;
      });
      itemIdx = presets.length;
      const html = base + (extra.length ? '<div class="res-label">🔎 その他の本（語数は手入力）</div>' + extra.map(itemHtml).join('') : (presets.length ? '' : '<p class="muted center">見つかりませんでした。手入力で登録できます。</p>'));
      setResults(html, [...presets, ...extra]);
    } catch (e) {
      if (e.name !== 'AbortError') setResults(base || '<p class="muted center">検索できませんでした。手入力で登録できます。</p>', [...presets]);
    }
  }, 450);
}

function pickBook(b) {
  picked = { title: b.title, author: b.author || '', cover: b.cover || (b.pid ? cachedCover(b.pid) || '' : ''), isbn: b.isbn || '', lang: b.lang || 'en', count: b.count || 0, pid: b.pid || '' };
  editing = null;
  showForm();
}

function showForm() {
  const b = picked;
  $('#addTitle').textContent = editing ? '記録を編集' : '読んだ本を記録';
  $('#addSearchView').hidden = true; $('#bookForm').hidden = false;
  $('#formCover').innerHTML = coverInner(b.cover, b.lang);
  $('#fTitle').value = b.title; $('#fAuthor').value = b.author || '';
  document.querySelector(`input[name=fLang][value=${b.lang}]`).checked = true;
  $('#fWords').value = b.lang === 'en' && b.count ? b.count : '';
  $('#fChars').value = b.lang === 'ja' && b.count ? b.count : '';
  $('#wordHint').textContent = b.pid ? '（目安・修正できます）' : '';
  $('#fDate').value = editing?.date || addDate;
  $('#fTimes').value = editing?.times || 1;
  $('#deleteLog').hidden = !editing;
  langFields();
  renderChildPick(editing?.childId);
}

function langFields() {
  const lang = document.querySelector('input[name=fLang]:checked').value;
  $('#enFields').hidden = lang !== 'en'; $('#jaFields').hidden = lang !== 'ja';
  $('#charPresets').innerHTML = JA_CHAR_PRESETS.map((p) => `<button type="button" data-chars="${p.chars}">${p.label}（約${fmt(p.chars)}字）</button>`).join('');
}

let pickedChild = null;
function renderChildPick(cid) {
  const cs = children();
  const a = activeChild();
  pickedChild = cid || (a !== 'all' ? a : cs[0]?.id);
  if (cs.length <= 1) { $('#childPick').innerHTML = ''; return; }
  $('#childPick').innerHTML = '<span class="muted small" style="width:100%">だれが読んだ？</span>' +
    cs.map((c) => `<button type="button" data-cid="${c.id}" class="${c.id === pickedChild ? 'on' : ''}">${esc(c.emoji)} ${esc(c.name)}</button>`).join('');
}

function saveForm(e) {
  e.preventDefault();
  const lang = document.querySelector('input[name=fLang]:checked').value;
  const count = Math.max(0, parseInt(lang === 'en' ? $('#fWords').value : $('#fChars').value, 10) || 0);
  if (lang === 'en' && !count && !confirm('語数が0のまま記録しますか？')) return;
  const now = Date.now();
  const data = {
    childId: pickedChild || children()[0].id,
    date: $('#fDate').value || todayStr(),
    lang, title: $('#fTitle').value.trim() || '（無題）', author: $('#fAuthor').value.trim(),
    cover: picked?.cover || '', isbn: picked?.isbn || '', pid: picked?.pid || '',
    count, times: Math.max(1, parseInt($('#fTimes').value, 10) || 1), updatedAt: now,
  };
  if (editing) Object.assign(editing, data);
  else state.logs.push({ id: uid(), createdAt: now, ...data });
  // 表示月を記録日に合わせる
  const [y, m] = data.date.split('-').map(Number);
  viewY = y; viewM = m - 1;
  $('#addDlg').close();
  commit();
  renderDay();
  toast(editing ? '更新しました' : (lang === 'en' ? `📘 +${fmt(count * data.times)}語 記録しました！` : '📕 記録しました！'));
  editing = null;
  maybeSilentSync();
}

// 記録のタイミング（ユーザー操作中）に Google トークンを取り直して同期
function maybeSilentSync() {
  if (sync.enabled && sync.linked && !sync.hasToken) sync.signIn(getState, setState);
}

// ---------------- バーコード ----------------
let scanner = null;
async function openScan() {
  $('#scanMsg').textContent = '本の裏の「978」から始まるバーコードを枠に合わせてください';
  $('#scanDlg').showModal();
  scanner = new IsbnScanner($('#scanVideo'));
  try {
    await scanner.start(async (isbn) => {
      $('#scanMsg').textContent = `ISBN ${isbn} を検索中…`;
      const b = await lookupIsbn(isbn);
      $('#scanDlg').close();
      if (!b) {
        toast('本が見つかりませんでした。手入力してください');
        pickBook({ title: '', isbn, lang: 'en' });
        return;
      }
      const p = findPresetByTitle(b.title);
      pickBook(p ? { ...b, count: p.count, pid: p.pid, lang: p.lang, cover: b.cover } : b);
    });
  } catch (e) {
    $('#scanMsg').textContent = 'カメラを使えませんでした。ブラウザの設定でカメラを許可してください。';
  }
}

// ---------------- シェア ----------------
async function openShare() {
  $('#shareName').checked = !!state.settings.shareShowName;
  $('#shareDlg').showModal();
  await drawShare();
}
function shareData() {
  const logs = logsFor();
  const prefix = `${viewY}-${pad(viewM + 1)}`;
  const mLogs = logs.filter((l) => l.date.startsWith(prefix));
  const m = aggregate(mLogs);
  const days = new Map();
  for (const [date, ls] of byDay(mLogs)) days.set(+date.slice(8), aggregate(ls));
  const a = activeChild();
  const name = $('#shareName').checked && a !== 'all' ? children().find((c) => c.id === a)?.name : '';
  return { year: viewY, month: viewM + 1, name, enWords: m.en, jaBooks: m.jaBooks, jaChars: m.jaChars, totalEn: aggregate(logs).en, streak: streak(logs), days };
}
async function drawShare() {
  const d = shareData();
  await renderShareImage($('#shareCanvas'), d);
  const text = `${d.month}月の多読：英語 ${fmt(d.enWords)}語（累計 ${fmt(d.totalEn)}語）、日本語 ${fmt(d.jaBooks)}冊📚\n#${CONFIG.hashtags.join(' #')}`;
  $('#shareX').href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(CONFIG.shareUrl)}`;
  $('#shareLine').href = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(CONFIG.shareUrl)}&text=${encodeURIComponent(text)}`;
  $('#shareNative').dataset.text = text;
}

// ---------------- 設定 ----------------
function openSettings() { renderSettings(); $('#setDlg').showModal(); }
function renderSettings() {
  $('#childList').innerHTML = children().map((c) => `
    <div class="child-row" data-cid="${c.id}">
      <input class="emoji" value="${esc(c.emoji)}" maxlength="4" aria-label="アイコン">
      <input class="name" value="${esc(c.name)}" maxlength="20" aria-label="名前（ニックネーム）">
      ${children().length > 1 ? '<button class="icon-btn del" aria-label="削除">🗑️</button>' : ''}
    </div>`).join('');
  const g = $('#gArea');
  if (!sync.enabled) {
    $('#gHead').hidden = true; g.innerHTML = '';
  } else if (sync.linked) {
    g.innerHTML = `<p class="muted small">Googleドライブのアプリ専用領域に保存中です。他の端末でも同じアカウントでログインすると記録が引き継がれます。</p>
      <div class="row2"><button class="btn" id="gSync">今すぐ同期</button><button class="btn danger" id="gOut">連携を解除</button></div>`;
  } else {
    g.innerHTML = `<p class="muted small">ログインすると、あなたのGoogleドライブ（アプリ専用の非公開領域）に自動保存され、スマホとPCで共有できます。サイト運営者からは見えません。</p>
      <button class="btn primary wide" id="gIn">Googleでログイン</button>`;
  }
}

function updateSyncUi(status, msg) {
  const b = $('#syncBtn');
  if (!sync.enabled) { b.hidden = true; return; }
  b.hidden = false; b.className = 'chip-btn';
  if (status === 'off' || (!sync.linked && !status)) b.textContent = '☁️ Googleで保存';
  else if (status === 'syncing') b.textContent = '🔄 同期中…';
  else if (status === 'ok') { b.textContent = '✅ 同期済み'; b.classList.add('ok'); }
  else if (status === 'stale') { b.textContent = '🔄 タップで同期'; b.classList.add('warn'); }
  else if (status === 'error') { b.textContent = '⚠️ 同期エラー'; b.classList.add('warn'); }
  if (msg) toast(msg);
  if ($('#setDlg').open) renderSettings();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tadoku-kiroku-${todayStr()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function importData(file) {
  try {
    const s = JSON.parse(await file.text());
    if (!Array.isArray(s.logs) || !Array.isArray(s.children)) throw new Error();
    if (!confirm(`${s.logs.filter((l) => !l.deleted).length}件の記録を読み込みます。今の記録と合わせますか？`)) return;
    const { mergeState } = await import('./storage.js');
    state = mergeState(state, s);
    commit(); renderSettings(); toast('読み込みました');
  } catch { toast('ファイルを読み込めませんでした'); }
}

// ---------------- イベント ----------------
function bind() {
  document.querySelectorAll('dialog').forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
  });
  $('#scanDlg').addEventListener('close', () => scanner?.stop());
  $('#dayDlg').addEventListener('close', () => { dayOpen = null; });

  $('#prevMonth').onclick = () => { if (--viewM < 0) { viewM = 11; viewY--; } render(); };
  $('#nextMonth').onclick = () => { if (++viewM > 11) { viewM = 0; viewY++; } render(); };
  $('#calGrid').onclick = (e) => { const d = e.target.closest('.day[data-date]'); if (d) openDay(d.dataset.date); };
  $('#childTabs').onclick = (e) => {
    const b = e.target.closest('button[data-c]'); if (!b) return;
    state.settings.activeChild = b.dataset.c; saveLocal(state); render();
  };
  $('#addBtn').onclick = () => openAdd(viewY === today.getFullYear() && viewM === today.getMonth() ? todayStr() : `${viewY}-${pad(viewM + 1)}-01`);
  $('#dayAdd').onclick = () => { $('#dayDlg').close(); openAdd(dayOpenLast); };
  $('#dayList').onclick = (e) => {
    const it = e.target.closest('[data-log]'); if (!it) return;
    const log = state.logs.find((l) => l.id === it.dataset.log);
    $('#dayDlg').close(); openAdd(log.date, log);
  };

  $('#searchInput').addEventListener('input', onSearch);
  $('#searchResults').onclick = (e) => { const it = e.target.closest('.item[data-i]'); if (it) pickBook(resultBooks[+it.dataset.i]); };
  $('#manualBtn').onclick = () => pickBook({ title: $('#searchInput').value.trim(), lang: /[぀-ヿ一-鿿]/.test($('#searchInput').value) ? 'ja' : 'en' });
  $('#scanBtn').onclick = openScan;
  $('#backBtn').onclick = () => { if (editing) { $('#addDlg').close(); editing = null; } else showSearch(); };
  document.querySelectorAll('input[name=fLang]').forEach((r) => r.addEventListener('change', () => {
    picked.lang = r.value; langFields(); $('#formCover').innerHTML = coverInner(picked.cover, picked.lang);
  }));
  $('#charPresets').onclick = (e) => { const b = e.target.closest('[data-chars]'); if (b) $('#fChars').value = b.dataset.chars; };
  $('#childPick').onclick = (e) => {
    const b = e.target.closest('[data-cid]'); if (!b) return;
    pickedChild = b.dataset.cid; renderChildPick(pickedChild);
  };
  $('#tMinus').onclick = () => { $('#fTimes').value = Math.max(1, (+$('#fTimes').value || 1) - 1); };
  $('#tPlus').onclick = () => { $('#fTimes').value = (+$('#fTimes').value || 1) + 1; };
  $('#bookForm').addEventListener('submit', saveForm);
  $('#deleteLog').onclick = () => {
    if (!editing || !confirm('この記録を削除しますか？')) return;
    editing.deleted = true; editing.updatedAt = Date.now();
    editing = null; $('#addDlg').close(); commit(); toast('削除しました');
  };

  $('#recoTabs').addEventListener('change', (e) => { recoLang = e.target.value; renderReco(); });
  $('#shareOpen').onclick = openShare;
  $('#shareName').onchange = () => { state.settings.shareShowName = $('#shareName').checked; saveLocal(state); drawShare(); };
  $('#shareSave').onclick = async () => {
    const f = await canvasToFile($('#shareCanvas'), `tadoku-${viewY}-${pad(viewM + 1)}.png`);
    const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click();
  };
  $('#shareNative').onclick = async () => {
    const f = await canvasToFile($('#shareCanvas'), `tadoku-${viewY}-${pad(viewM + 1)}.png`);
    const text = $('#shareNative').dataset.text + '\n' + CONFIG.shareUrl;
    if (navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f], text }); } catch { /* キャンセル */ }
    } else {
      $('#shareSave').click();
      toast('画像を保存しました。SNSに添付して投稿してください');
    }
  };

  $('#settingsBtn').onclick = openSettings;
  $('#syncBtn').onclick = () => sync.signIn(getState, setState);
  $('#addChild').onclick = () => {
    const emojis = ['🐰', '🐱', '🐶', '🦁', '🐼', '🐸', '🐥'];
    state.children.push({ id: 'c' + uid(), name: `子ども${children().length + 1}`, emoji: emojis[children().length % emojis.length], updatedAt: Date.now() });
    commit(); renderSettings();
  };
  $('#childList').addEventListener('change', (e) => {
    const row = e.target.closest('.child-row'); if (!row) return;
    const c = state.children.find((x) => x.id === row.dataset.cid);
    c.name = row.querySelector('.name').value.trim() || c.name;
    c.emoji = row.querySelector('.emoji').value.trim() || c.emoji;
    c.updatedAt = Date.now(); commit();
  });
  $('#childList').addEventListener('click', (e) => {
    if (!e.target.closest('.del')) return;
    const row = e.target.closest('.child-row');
    const c = state.children.find((x) => x.id === row.dataset.cid);
    const n = state.logs.filter((l) => l.childId === c.id && !l.deleted).length;
    if (!confirm(`「${c.name}」を削除しますか？（記録${n}件も削除されます）`)) return;
    const now = Date.now();
    c.deleted = true; c.updatedAt = now;
    state.logs.forEach((l) => { if (l.childId === c.id) { l.deleted = true; l.updatedAt = now; } });
    commit(); renderSettings();
  });
  $('#gArea').addEventListener('click', (e) => {
    if (e.target.id === 'gIn' || e.target.id === 'gSync') {
      if (sync.hasToken) sync.sync(getState, setState); else sync.signIn(getState, setState);
    } else if (e.target.id === 'gOut') {
      if (confirm('Google連携を解除しますか？（この端末の記録は残ります）')) { sync.signOut(); renderSettings(); }
    }
  });
  $('#exportBtn').onclick = exportData;
  $('#importFile').onchange = (e) => { const f = e.target.files[0]; if (f) importData(f); e.target.value = ''; };
  $('#resetBtn').onclick = () => {
    if (!confirm('この端末の記録をすべて消します。よろしいですか？')) return;
    if (!confirm('本当に消しますか？（元に戻せません）')) return;
    try { localStorage.removeItem('tadoku-kiroku-v1'); } catch { /* noop */ }
    state = loadState(); commit(); $('#setDlg').close(); toast('消去しました');
  };
}


// ---------------- iframe 埋め込み時の高さ通知 ----------------
function autoHeight() {
  if (window.parent === window) return;
  const post = () => window.parent.postMessage({ type: 'tadoku-height', height: document.documentElement.scrollHeight }, '*');
  new ResizeObserver(post).observe(document.body);
  post();
}

bind();
render();
updateSyncUi(sync.linked ? 'stale' : 'off');
autoHeight();
