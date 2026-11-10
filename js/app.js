import { CONFIG } from './config.js';
import { PRESET_BOOKS } from './books-db.js';
import { loadState, saveLocal, uid, DriveSync } from './storage.js';
import { norm, titleKeys, shareTargets, seriesTarget, searchCoverStrict, searchPresets, searchGoogleBooks, lookupIsbn, findPresetByTitle, fetchPresetCover, cachedCover, amazonUrl, rakutenUrl, mercariUrl, withIsbnCovers, loadPubAges, pubAge, searchPub, loadEnLib, enLibBook, searchEnLib } from './books.js';
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
// 表示中の人（「みんな」の合計表示はなくしたので、必ずだれか1人）
const activeChild = () => {
  const a = state.settings.activeChild;
  return children().some((c) => c.id === a) ? a : children()[0]?.id;
};
// 記録する言語：'both'（日本語と英語）/'ja'（日本語だけ）/'en'（英語だけ）。片方だけなら、もう片方の記録や機能は見せない
const langMode = () => state.settings.langMode || 'both';
const langOk = (lang) => langMode() === 'both' || lang === langMode();
const logsFor = (cid = activeChild()) => state.logs.filter((l) => !l.deleted && (cid === 'all' || l.childId === cid) && langOk(l.lang));

// 文字数・語数が0で記録された本は、リストにある推定値で補う（以前の記録も集計に入るように）
const PRESET_COUNT = new Map(PRESET_BOOKS.map((b) => [b.pid, b.count]));
const countOf = (l) => l.count || (l.pid && PRESET_COUNT.get(l.pid)) || 0;

function aggregate(logs) {
  const r = { en: 0, jaBooks: 0, jaChars: 0, enBooks: 0 };
  for (const l of logs) {
    const t = l.times || 1;
    if (l.lang === 'en') { r.en += countOf(l) * t; r.enBooks += t; }
    else { r.jaBooks += t; r.jaChars += countOf(l) * t; }
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
function applyLangMode() {
  const m = langMode();
  document.body.dataset.only = m === 'both' ? '' : m;
  if (m !== 'both') {
    recoLang = m;
    const r = document.querySelector(`input[name=recoLang][value=${m}]`); if (r) r.checked = true;
  }
  const s = document.querySelector(`input[name=langMode][value=${m}]`); if (s) s.checked = true;
}

function render() {
  applyLangMode();
  renderTabs();
  renderStats();
  renderCalendar();
  renderChart();
  renderAgeChart();
  renderHistory();
  renderReco();
}

function renderTabs() {
  const cs = children();
  const el = $('#childTabs');
  if (cs.length <= 1) { el.innerHTML = ''; return; }
  const a = activeChild();
  el.innerHTML = cs.map((c) => `<button data-c="${c.id}" class="${a === c.id ? 'on' : ''}">${esc(c.emoji)} ${esc(c.name)}</button>`).join('');
}

function renderStats() {
  const logs = logsFor();
  const mPrefix = `${viewY}-${pad(viewM + 1)}`;
  const month = aggregate(logs.filter((l) => l.date.startsWith(mPrefix)));
  const all = aggregate(logs);
  // 日本語は文字数と冊数、英語は語数と冊数を並べて表示
  const card = (cls, label, count, unit, books) => `
    <div class="stat ${cls}"><div class="lbl">${label}</div>
      <div class="val">${fmt(count)}<small>${unit}</small></div>
      <div class="books">${fmt(books)}冊</div></div>`;
  // 日本語は冊数だけ
  const jaCard = (label, books) => `
    <div class="stat ja"><div class="lbl">${label}</div>
      <div class="val">${fmt(books)}<small>冊</small></div>
      <div class="books">&nbsp;</div></div>`;
  $('#stats').innerHTML =
    jaCard(`${viewM + 1}月の日本語`, month.jaBooks) +
    card('en', `${viewM + 1}月の英語`, month.en, '語', month.enBooks) +
    jaCard('日本語の累計', all.jaBooks) +
    card('en', '英語の累計', all.en, '語', all.enBooks);
}

const shortNum = (n) => n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + '万' : String(Math.round(n || 0)); // マスに収まるようカンマなし

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
      ${a.jaBooks ? `<span class="b">${a.jaBooks}冊</span>` : ''}
      ${a.en ? `<span class="w">${shortNum(a.en)}</span>` : ''}
    </button>`;
  }
  $('#calGrid').innerHTML = html;
  const m = aggregate(logsFor().filter((l) => l.date.startsWith(`${viewY}-${pad(viewM + 1)}`)));
  const readDays = [...map.keys()].filter((k) => k.startsWith(`${viewY}-${pad(viewM + 1)}`)).length;
  $('#monthSum').innerHTML = `<span class="ja">日本語 ${fmt(m.jaBooks)}冊</span><span class="en">英語 ${fmt(m.en)}語（${fmt(m.enBooks)}冊）</span><span>📅 ${readDays}日読んだ</span>`;
}

// ---------------- 英語の語数グラフ（棒グラフ） ----------------
let chartMode = 'month';
const niceMax = (v) => {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v)), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};
const axisNum = (v) => (v >= 10000 ? `${+(v / 10000).toFixed(1)}万` : fmt(v));

function chartData() {
  const logs = logsFor().filter((l) => l.lang === 'en');
  if (chartMode === 'day') {
    const days = new Date(viewY, viewM + 1, 0).getDate();
    const prefix = `${viewY}-${pad(viewM + 1)}-`;
    const sums = Array(days).fill(0);
    for (const l of logs) if (l.date.startsWith(prefix)) sums[+l.date.slice(8) - 1] += countOf(l) * (l.times || 1);
    return sums.map((v, i) => ({ label: `${i + 1}`, full: `${viewM + 1}月${i + 1}日`, v, tick: i === 0 || (i + 1) % 5 === 0 }));
  }
  const out = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(viewY, viewM - k, 1);
    const prefix = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const v = logs.filter((l) => l.date.startsWith(prefix)).reduce((s, l) => s + countOf(l) * (l.times || 1), 0);
    out.push({ label: `${d.getMonth() + 1}月`, full: `${d.getFullYear()}年${d.getMonth() + 1}月`, v, tick: true });
  }
  return out;
}

function renderChart() {
  const data = chartData();
  const W = 340, H = 170, L = 34, R = 6, T = 14, B = 22;
  const max = niceMax(Math.max(...data.map((d) => d.v)));
  const slot = (W - L - R) / data.length;
  const bw = Math.min(24, slot * 0.7);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, max / 2, max];
  const total = data.reduce((s, d) => s + d.v, 0);
  // いちばん多い棒にだけ数値を出す（全部の棒に数字は付けない）
  const peak = data.reduce((m, d, i) => (d.v > (data[m]?.v || 0) ? i : m), -1);
  let svg = ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${L - 4}" y="${y(t) + 3}" text-anchor="end">${axisNum(t)}</text>`).join('');
  data.forEach((d, i) => {
    const cx = L + slot * i + slot / 2;
    if (d.v > 0) {
      const top = y(d.v), h = H - B - top, r = Math.min(4, h, bw / 2), x = cx - bw / 2;
      // 先端だけ角丸、根元は四角
      svg += `<path class="bar" d="M${x},${H - B} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - B} Z"/>`;
      if (i === peak) svg += `<text class="val" x="${cx}" y="${top - 4}" text-anchor="middle">${axisNum(d.v)}</text>`;
    }
    if (d.tick) svg += `<text class="axis" x="${cx}" y="${H - 6}" text-anchor="middle">${d.label}</text>`;
    svg += `<rect class="hit" data-i="${i}" x="${L + slot * i}" y="${T}" width="${slot}" height="${H - T - B}"/>`;
  });
  const el = $('#enChart');
  el.setAttribute('viewBox', `0 0 ${W} ${H}`);
  el.setAttribute('aria-label', `英語の語数 ${chartMode === 'day' ? '日ごと' : '月ごと'}。合計${fmt(total)}語`);
  el.innerHTML = svg;
  el._data = data;
  $('#chartTip').hidden = true;
  const avg = chartMode === 'month' ? Math.round(total / Math.max(1, data.filter((d) => d.v).length)) : 0;
  $('#chartSum').innerHTML = chartMode === 'day'
    ? `${viewM + 1}月の合計 <b>${fmt(total)}語</b>`
    : `12か月の合計 <b>${fmt(total)}語</b>${avg ? `（読んだ月の平均 ${fmt(avg)}語）` : ''}`;
  $('#chartTable').innerHTML = `<table><tr><th>${chartMode === 'day' ? '日' : '月'}</th><th>語数</th></tr>${data.filter((d) => chartMode === 'month' || d.v).map((d) => `<tr><td>${d.full}</td><td>${fmt(d.v)}</td></tr>`).join('')}</table>`;
}

function showChartTip(e) {
  const hit = e.target.closest('.hit');
  const tip = $('#chartTip');
  if (!hit) { tip.hidden = true; return; }
  const d = $('#enChart')._data[+hit.dataset.i];
  const box = $('#enChart').getBoundingClientRect(), r = hit.getBoundingClientRect();
  tip.textContent = `${d.full}：${fmt(d.v)}語`;
  tip.style.left = `${Math.min(box.width - 60, Math.max(60, r.left - box.left + r.width / 2))}px`;
  tip.style.top = `${r.top - box.top + 12}px`;
  tip.hidden = false;
}

// ---------------- 対象年齢の推移（折れ線） ----------------
// 「○歳から向け」の数値。日本語：0〜6歳はそのまま、7＝小学校低学年、8＝中学年、9＝高学年
const jaAgeNum = (a) => (a <= 7 ? a : a === 8 ? 8 : 10);
// 英語：レベルの目安を英語圏の「○歳から」に（enAge の区切りと同じ）
const enAgeNum = (lv) => ([[0.5, 1], [1.0, 3], [1.6, 4], [2.4, 5], [3.5, 6], [5.0, 8], [6.5, 9]].find(([m]) => lv <= m) || [0, 10])[1];
const PRESET_BY_PID = new Map(PRESET_BOOKS.map((b) => [b.pid, b]));

// 1冊ごとの対象年齢（記録の年齢 → リストの本の年齢 → 目安の順）
function logAge(l) {
  const b = PRESET_BY_PID.get(l.pid);
  if (l.tgtAge != null) return l.tgtAge;
  if (b?.tgtAge != null) return b.tgtAge;
  if (l.lang === 'ja') return b?.age != null ? jaAgeNum(b.age) : null;
  return b?.lv != null && !/Bookworms/.test(b.gr || '') ? enAgeNum(b.lv) : null;
}

// 記録を1冊ずつ点にする。期間は「表示している月までの12か月」か「最初の記録から最新の記録まで」
let ageRange = '12m';
function ageData() {
  const all = logsFor().map((l) => ({ l, age: logAge(l) })).filter((p) => p.age != null)
    .sort((a, b) => (a.l.date < b.l.date ? -1 : a.l.date > b.l.date ? 1 : 0));
  let start, end;
  if (ageRange === 'all' && all.length) {
    const [y0, m0] = all[0].l.date.split('-').map(Number), [y1, m1] = all[all.length - 1].l.date.split('-').map(Number);
    start = new Date(y0, m0 - 1, 1); end = new Date(y1, m1, 1);
    if ((end - start) / 864e5 < 360) start = new Date(end.getFullYear(), end.getMonth() - 12, 1); // 1年未満なら12か月ぶん
  } else {
    start = new Date(viewY, viewM - 11, 1); end = new Date(viewY, viewM + 1, 1);
  }
  const s0 = ymd(start), s1 = ymd(end);
  const pts = all.filter((p) => p.l.date >= s0 && p.l.date < s1);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  return { start, end, pts, months };
}

function renderAgeChart() {
  const { start, end, pts, months } = ageData();
  const W = 340, H = months > 12 ? 170 : 130, L = 30, R = 10, T = 8, B = 20;
  const maxAge = Math.max(6, ...pts.map((p) => p.age));
  const max = Math.ceil((maxAge + 1) / 2) * 2;
  const span = end - start;
  const x = (date) => L + (W - L - R) * ((new Date(date) - start) / span);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  let svg = '';
  const step = max <= 8 ? 2 : max <= 12 ? 4 : 6;
  for (let t = 0; t <= max; t += step) svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${L - 4}" y="${y(t) + 3}" text-anchor="end">${t}歳</text>`;
  if (months > 24) { // 長い期間は年ごとの目盛り
    for (let k = 0; k < months; k++) {
      const d = new Date(start.getFullYear(), start.getMonth() + k, 1);
      if (d.getMonth() !== 0) continue;
      svg += `<line class="grid" x1="${x(d)}" x2="${x(d)}" y1="${T}" y2="${H - B}"/><text class="axis" x="${x(d) + 3}" y="${H - 5}">${d.getFullYear()}</text>`;
    }
  } else {
    const st = Math.max(2, Math.ceil(months / 6));
    for (let k = 0; k < months; k += st) {
      const d = new Date(start.getFullYear(), start.getMonth() + k, 1);
      svg += `<text class="axis" x="${x(d) + 4}" y="${H - 5}">${k === 0 || d.getMonth() === 0 ? `${String(d.getFullYear()).slice(2)}年` : ''}${d.getMonth() + 1}月</text>`;
    }
  }
  // 直近の平均の線（上がっていく様子を見やすくする。点が多いときは平均する冊数も増やす）
  const win = Math.max(8, Math.round(pts.length / 40));
  let trend = '';
  for (const lang of ['ja', 'en']) {
    const ps = pts.filter((p) => p.l.lang === lang);
    if (ps.length < 3) continue;
    const line = ps.map((p, i) => {
      const w = ps.slice(Math.max(0, i - win + 1), i + 1);
      return `${i ? 'L' : 'M'}${x(p.l.date).toFixed(1)},${y(w.reduce((s, q) => s + q.age, 0) / w.length).toFixed(1)}`;
    }).join(' ');
    trend += `<path class="trend-halo" d="${line}"/><path class="trend ${lang}" d="${line}"/>`;
  }
  // 1冊ずつの点（同じ日・同じ年齢の点は少し横にずらす）
  const seen = new Map();
  const big = pts.length > 300, r = big ? 2 : 3.5, gap = big ? 0 : 4;
  const drawn = pts.map((p) => {
    const key = p.l.date + p.l.lang + p.age;
    const n = seen.get(key) || 0; seen.set(key, n + 1);
    const cx = x(p.l.date) + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * gap;
    // 点が多いときは、同じ年齢の点が1本の線に重ならないよう上下に少しだけ散らす（値そのものは変えない）
    // 日本語は少し上、英語は少し下に寄せて、同じ年齢でも両方の点が見えるようにする
    const jit = big ? ((((n * 7 + p.l.date.charCodeAt(9) * 13 + p.l.title.length * 5) % 11) / 10) * 0.3 + 0.03) * (p.l.lang === 'ja' ? 1 : -1) : 0;
    const cy = y(p.age + jit);
    return { ...p, cx, cy };
  });
  for (const d of drawn) {
    svg += d.l.lang === 'ja'
      ? `<circle class="dot ja" cx="${d.cx.toFixed(1)}" cy="${d.cy.toFixed(1)}" r="${r}"/>`
      : `<rect class="dot en" x="${(d.cx - r).toFixed(1)}" y="${(d.cy - r).toFixed(1)}" width="${r * 2}" height="${r * 2}" rx="${r / 2}"/>`;
  }
  svg += trend; // 平均の線は点の上に重ねる
  const el = $('#ageChart');
  el.setAttribute('viewBox', `0 0 ${W} ${H}`);
  el.setAttribute('aria-label', `読んだ本の対象年齢。${pts.length}冊`);
  el.innerHTML = svg;
  el._pts = drawn;
  $('#ageTip').hidden = true;
  $('#ageEmpty').hidden = pts.length > 0;
  // 表：月ごと（長い期間は半年ごと）の平均
  const rows = [], per = months > 24 ? 6 : 1;
  const avg = (ps) => (ps.length ? `${+(ps.reduce((s, p) => s + p.age, 0) / ps.length).toFixed(1)}歳〜（${ps.length}冊）` : '—');
  for (let k = 0; k < months; k += per) {
    const d = new Date(start.getFullYear(), start.getMonth() + k, 1), e = new Date(start.getFullYear(), start.getMonth() + k + per, 1);
    const a = ymd(d), b = ymd(e), inR = pts.filter((p) => p.l.date >= a && p.l.date < b);
    const label = per === 1 ? `${d.getFullYear()}年${d.getMonth() + 1}月` : `${d.getFullYear()}年${d.getMonth() + 1}月〜`;
    rows.push(`<tr><td>${label}</td><td>${avg(inR.filter((p) => p.l.lang === 'ja'))}</td><td>${avg(inR.filter((p) => p.l.lang === 'en'))}</td></tr>`);
  }
  $('#ageTable').innerHTML = `<table><tr><th>${per === 1 ? '月' : '半年'}（平均）</th><th>日本語</th><th>英語</th></tr>${rows.join('')}</table>`;
}

// 点をタップ（またはなぞる）と、いちばん近い本の名前と対象年齢を出す
function showAgeTip(e) {
  const el = $('#ageChart'), tip = $('#ageTip');
  const box = el.getBoundingClientRect();
  if (!el._pts?.length || !box.width) { tip.hidden = true; return; }
  const sx = 340 / box.width;
  const px = (e.clientX - box.left) * sx, py = (e.clientY - box.top) * sx;
  let best = null, bd = 14 * 14;
  for (const p of el._pts) { const d = (p.cx - px) ** 2 + (p.cy - py) ** 2; if (d < bd) { bd = d; best = p; } }
  if (!best) { tip.hidden = true; return; }
  const [, m, dd] = best.l.date.split('-');
  tip.textContent = `${ageRange === 'all' ? best.l.date.slice(2, 4) + '/' : ''}${+m}/${+dd}　${best.l.title.slice(0, 24)}（${+best.age.toFixed(1)}歳〜）`;
  tip.style.left = `${Math.min(box.width - 120, Math.max(120, best.cx / sx))}px`;
  tip.style.top = `${best.cy / sx - 6}px`;
  tip.hidden = false;
}

// ---------------- これまでに読んだ本（一覧・検索） ----------------
let historyLang = 'all', historyLimit = 30;
function historyBooks() {
  // 同じ本（同じ言語・同じタイトル）はまとめて、回数と最後に読んだ日を出す
  const map = new Map();
  for (const l of logsFor()) {
    const key = l.lang + '|' + l.title;
    const h = map.get(key) || { ...l, times: 0, words: 0, first: l.date, last: l.date };
    h.times += l.times || 1;
    h.words += countOf(l) * (l.times || 1);
    if (l.date > h.last) { h.last = l.date; h.cover = l.cover || h.cover; }
    if (l.date < h.first) h.first = l.date;
    map.set(key, h);
  }
  return [...map.values()].sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0));
}
function renderHistory() {
  const all = historyBooks();
  $('#historyCount').textContent = all.length ? `${fmt(all.length)}冊` : '';
  if (!$('#historyCard').open) return; // 開いた時だけ描く
  const q = norm($('#historySearch').value);
  const list = all.filter((h) => (historyLang === 'all' || h.lang === historyLang)
    && (!q || norm(h.title).includes(q) || norm(h.author || '').includes(q)));
  const md = (d) => { const [, m, dd] = d.split('-'); return `${+m}/${+dd}`; };
  const shown = list.slice(0, historyLimit);
  $('#historyList').innerHTML = shown.length ? shown.map((h, i) => `
    <button class="item" data-h="${i}">
      <div class="cover">${coverInner(withIsbnCovers(h.cover, h.isbn), h.lang)}</div>
      <div class="grow"><div class="t"><span class="tag ${h.lang}">${h.lang === 'en' ? '英' : '日'}</span>${esc(h.title)}</div>
      <div class="a">${h.times}回・最後に読んだ日 ${md(h.last)}${h.lang === 'en' && h.words ? '・' + fmt(h.words) + '語' : ''}</div></div>
      <div class="n ${h.lang}">もう一度</div></button>`).join('')
    : `<p class="muted center small">${all.length ? '見つかりませんでした' : 'まだ記録がありません'}</p>`;
  $('#historyMore').hidden = list.length <= historyLimit;
  $('#historyList')._items = shown;
}

// ---------------- おすすめ ----------------
// 英語：最近読んだ英語の本のレベル平均から「同じくらい」4冊＋「少し上」4冊
// 日本語：最近読んだ日本語の本の文字数から「同じくらい」4冊＋「少し長め」4冊
let recoLang = 'ja';

// 同じくらいの点数の本は日替わりで入れ替える（いつも同じ本ばかりにならないように）
function dailyJitter(pid) {
  let h = 0;
  for (const c of pid + todayStr()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % 1000) / 1000 * 0.4;
}

function pickBooks(cands, scoreFn, n, used) {
  const out = [];
  for (const { b, s } of cands.map((b) => ({ b, s: scoreFn(b) })).filter((x) => x.s != null).map((x) => ({ ...x, s: x.s + dailyJitter(x.b.pid) })).sort((x, y) => x.s - y.s)) {
    const key = b.gr ? b.pid : (b.series || b.pid); // グレイデッドリーダーは同じステージから複数出してよい
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
  // その子のお気に入り：最近40冊でよく読んでいるシリーズ・作者（読み返した回数も数える）と、シリーズで読んだいちばん新しい巻
  const favSeries = new Map(), favAuthor = new Map(), maxNum = new Map();
  const authorKey = (s) => norm(String(s || '').split(/[,、・／/]/)[0]);
  for (const l of logs.filter((x) => x.lang === recoLang).slice(0, 40)) {
    const p = preset(l), t = l.times || 1;
    if (p?.series) {
      favSeries.set(p.series, (favSeries.get(p.series) || 0) + t);
      const n = volNum(p);
      if (n != null) maxNum.set(p.series, Math.max(maxNum.get(p.series) ?? 0, n));
    }
    const ak = authorKey(l.author || p?.author);
    if (ak) favAuthor.set(ak, (favAuthor.get(ak) || 0) + t);
  }
  // つながりがある本ほど上に（シリーズの次の巻 ＞ よく読むシリーズ ＞ 同じ作者）。理由はカードにも表示
  const relCache = new Map();
  const rel = (b) => {
    if (relCache.has(b.pid)) return relCache.get(b.pid);
    let r = { s: 0, why: '' };
    const sameAuthorSeries = b.series && authorKey(b.series) === authorKey(b.author);
    if (b.series && favSeries.has(b.series) && !sameAuthorSeries) {
      const n = volNum(b), mx = maxNum.get(b.series);
      if (n != null && mx != null && n > mx && n <= mx + 3) r = { s: 0.65 - 0.05 * (n - mx - 1), why: '📚 シリーズの次の巻' };
      else r = { s: 0.35 + Math.min(0.2, favSeries.get(b.series) * 0.04), why: '📚 よく読むシリーズ' };
    } else if (favAuthor.has(authorKey(b.author))) {
      r = { s: 0.25 + Math.min(0.15, favAuthor.get(authorKey(b.author)) * 0.03), why: '✍️ よく読む作者の本' };
    } else if (b.classic) r = { s: 0.05, why: '⭐ 定番の人気作' };
    relCache.set(b.pid, r);
    return r;
  };
  const slack = (b) => (rel(b).s >= 0.25 ? 0.5 : 0); // つながりのある本はレベルの幅を少し広げて拾う
  // おすすめには、文字数・語数の根拠がある本（実際のページ数や全文から計算できた本）だけを出す
  const a = activeChild();
  const adultMode = a === 'all' ? children().some((c) => c.adult) : !!children().find((c) => c.id === a)?.adult;
  const cands = PRESET_BOOKS.filter((b) => b.lang === recoLang && (b.reliable || (adultMode && b.gr)) && !readPids.has(b.pid) && !readTitles.has(b.title) && !/平均/.test(b.title));
  // 表紙が出なかった本は順位を下げる（外しはしない）。表紙が出た本はわずかに優先
  const coverScore = (b) => (coverMissed(b.pid) ? 0.6 : coverStatus[b.pid] === 1 ? -0.05 : 0);
  const bonus = (b) => -rel(b).s + (/1冊/.test(b.title) ? 0.3 : 0) + coverScore(b)
    + (b.classic || b.gr ? 0 : Math.max(0, 0.3 - Math.log10((b.rl || 0) + 1) / 10)) // 定番・人気の本を優先
    ;
  const used = new Set();
  let same, up, note;

  if (recoLang === 'en') {
    const levels = recent.map((l) => preset(l)?.lv ?? estimateLevel(l.count)).filter((v) => v != null);
    const avg = levels.length ? levels.reduce((s, v) => s + v, 0) / levels.length : null;
    const base = avg ?? 0.3;
    const sameScore = (b) => (Math.abs(b.lv - base) <= 0.5 + slack(b) ? Math.abs(b.lv - base) + bonus(b) : null);
    const upScore = (b) => (b.lv > base + 0.2 && b.lv <= base + 1.5 ? Math.abs(b.lv - (base + 0.7)) + bonus(b) : null);
    if (adultMode) {
      // 大人：学習者向けの本2冊＋子ども向けの本2冊ずつ（レベル的に子どもの本を読みたい人もいるので両方出す）
      const learner = cands.filter((b) => b.gr), kids = cands.filter((b) => !b.gr);
      same = [...pickBooks(learner, sameScore, 2, used), ...pickBooks(kids, sameScore, 2, used)];
      up = [...pickBooks(learner, upScore, 2, used), ...pickBooks(kids, upScore, 2, used)];
    } else {
      same = pickBooks(cands, sameScore, 4, used);
      up = pickBooks(cands, upScore, 4, used);
    }
    // 足りない時は条件をゆるめて補う
    if (same.length < 4) same.push(...pickBooks(cands, (b) => Math.abs(b.lv - base), 4 - same.length, used));
    if (up.length < 4) up.push(...pickBooks(cands, (b) => (b.lv > base ? b.lv - base : null), 4 - up.length, used));
    note = avg == null ? 'まだ英語の記録がないので、はじめての1冊におすすめの本を選びました。'
      : `最近読んでいる英語の本は「${ageText(enAge(avg), enAgeNum(avg))}」向けくらい。それをもとに選びました。`;
  } else {
    // 日本語は対象年齢の目安で選ぶ（リストにない本は、入力された文字数からおおよその年齢を推定）
    const ages = recent.map((l) => preset(l)?.age ?? charsToAge(l.count)).filter((v) => v != null);
    const avg = ages.length ? ages.reduce((s, v) => s + v, 0) / ages.length : null;
    const base = avg ?? 1;
    same = pickBooks(cands, (b) => (Math.abs(b.age - base) <= 0.75 + slack(b) ? Math.abs(b.age - base) + bonus(b) : null), 4, used);
    up = pickBooks(cands, (b) => (b.age > base + 0.5 && b.age <= base + 2.5 ? Math.abs(b.age - (base + 1.5)) + bonus(b) : null), 4, used);
    if (same.length < 4) same.push(...pickBooks(cands, (b) => Math.abs(b.age - base), 4 - same.length, used));
    if (up.length < 4) up.push(...pickBooks(cands, (b) => (b.age > base ? b.age - base : null), 4 - up.length, used));
    note = avg == null ? 'まだ日本語の記録がないので、小さい子に人気の絵本を選びました。'
      : `最近読んでいる日本語の本は「${ageText('', jaAgeNum(Math.round(avg)))}」向けくらい。それをもとに選びました。`;
  }

  $('#recoNote').textContent = note;
  const card = (b) => recoCard(b, rel(b).why);
  $('#recoSame').innerHTML = same.map(card).join('');
  $('#recoUp').innerHTML = up.map(card).join('') || '<p class="muted small">今のところ、これより上のおすすめはありません。</p>';
  [...same, ...up].forEach((b) => {
    if (cachedCover(b.pid) !== undefined) return;
    fetchPresetCover(b).then((url) => {
      if (!url) { markCover(b.pid, 0); return; }
      document.querySelectorAll(`.reco-img[data-pid="${b.pid}"]`).forEach((el) => { el.innerHTML = recoCover(url, b); });
    });
  });
}

// タイトルの「#3」などの巻数
const volNum = (b) => { if (b?.num != null) return b.num; const m = /#\s?(\d+)/.exec(b?.title || ''); return m ? +m[1] : null; };

function recoCard(b, why = '') {
  return `
    <div class="reco">
      <a class="reco-img" href="${esc(amazonUrl(b))}" target="_blank" rel="noopener sponsored" data-pid="${b.pid}">${recoCover(cachedCover(b.pid), b)}</a>
      ${why ? `<div class="rel">${why}</div>` : ''}
      <div class="t">${esc(b.title)}</div>
      ${bookAgeText(b) ? `<div class="age ${b.lang}">${bookAgeText(b)}</div>` : b.gr ? `<div class="age ${b.lang}">${esc(b.gr)}</div>` : ''}
      <div class="why">${b.lang === 'en' && b.count ? `<b class="cnt en">${fmt(b.count)}語</b>・` : ''}${esc(b.author || b.series)}</div>
      <div class="links">
        <a class="btn amazon" href="${esc(amazonUrl(b))}" target="_blank" rel="noopener sponsored">Amazon</a>
        <a class="btn rakuten" href="${esc(rakutenUrl(b))}" target="_blank" rel="noopener sponsored">楽天</a>
        <a class="btn mercari" href="${esc(mercariUrl(b))}" target="_blank" rel="noopener sponsored">メルカリ</a>
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

// ---------------- 対象年齢の表示 ----------------
// どこから取った年齢か（出版社・シリーズ・書店・YL など）はデータ（tgt）に残すが、画面には出さず「○〜○歳」「○歳〜」だけを見せる
function ageText(label, age) {
  const m = /(\d+)\s*[〜~～-]\s*(\d+)\s*歳/.exec(label || '');
  if (m) return `${+m[1]}〜${+m[2]}歳`;
  return age != null ? `${Math.round(age)}歳〜` : '';
}
// 本の対象年齢の表示（記録・リストの年齢 → 目安）。分からなければ空
function bookAgeText(b) {
  const k = knownAge(b);
  if (k) return ageText(k.label, k.age);
  if (b.lang === 'ja' && b.age != null) return ageText('', jaAgeNum(b.age));
  if (b.lang === 'en' && b.lv != null && !b.gr) return ageText(enAge(b.lv), enAgeNum(b.lv));
  return '';
}

// 対象年齢の目安（英語は英語圏の子どもの年齢、日本語は○歳ごろから）
function enAge(lv) {
  const t = [[0.5, '1〜3歳'], [1.0, '3〜5歳'], [1.6, '4〜6歳'], [2.4, '5〜7歳'], [3.5, '6〜8歳'], [5.0, '8〜10歳'], [6.5, '9〜12歳']];
  return '英語圏の' + ((t.find(([max]) => lv <= max) || [0, '10歳〜'])[1]) + '向け';
}
// 対象年齢の目安（0〜6＝○歳ごろから、7＝小学校低学年、8＝中学年、9＝高学年）
function jaAge(age) {
  if (age == null) return '';
  if (age <= 6) return `${age}歳ごろから`;
  return ['小学校低学年から', '小学校中学年から', '小学校高学年から'][Math.min(age, 9) - 7];
}
// リストにない日本語の本：入力された文字数から年齢をざっくり推定（おすすめ選びにだけ使う）
function charsToAge(chars) {
  if (!chars) return null;
  const t = [[200, 0], [700, 1], [2000, 3], [5000, 4], [15000, 5], [50000, 7]];
  return (t.find(([max]) => chars <= max) || [0, 8])[1];
}

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
  $('#daySum').innerHTML = logs.length ? `<span class="ja">日本語 ${a.jaBooks}冊</span><span class="en">英語 ${fmt(a.en)}語</span>` : '<span class="muted">まだ記録がありません</span>';
  const multi = children().length > 1;
  $('#dayList').innerHTML = logs.map((l) => {
    const c = multi ? children().find((x) => x.id === l.childId) : null;
    const t = l.times || 1;
    const cnt = countOf(l);
    const n = l.lang === 'en' ? (cnt ? `${fmt(cnt * t)}語` : '') : `${t}冊`;
    return `<button class="item" data-log="${l.id}">
      <div class="cover">${coverInner(withIsbnCovers(l.cover, l.isbn), l.lang)}</div>
      <div class="grow"><div class="t"><span class="tag ${l.lang}">${l.lang === 'en' ? '英' : '日'}</span>${esc(l.title)}</div>
      <div class="a">${c ? esc(c.emoji + ' ' + c.name) + '・' : ''}${t > 1 ? t + '回読んだ・' : ''}タップで編集</div></div>
      <div class="n ${l.lang}">${n}</div></button>`;
  }).join('');
}

// ---------------- 追加ダイアログ ----------------
let addDate = null;
function openAdd(date = null, log = null) {
  loadPubAges(); loadEnLib(); // 検索・記録で使う出版社の対象年齢・洋書の語数リストを先に読み込んでおく
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
  const popular = ['はらぺこあおむし', 'ぐりとぐら', 'だるまさんが', 'Oxford Reading Tree Stage 1+（1冊）', 'Brown Bear, Brown Bear, What Do You See?', 'The Very Hungry Caterpillar', 'Elephant & Piggie（1冊・平均）', 'Frog and Toad Are Friends', 'Magic Tree House #1 Dinosaurs Before Dark']
    .map((t) => PRESET_BOOKS.find((b) => b.title === t)).filter((b) => b && langOk(b.lang));
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
    if (!b?.pid || b.cover) return;
    // 一覧を描き直したときも、取得済みの表紙はそのまま出す（描き直しで消えないように）
    const c = cachedCover(b.pid);
    if (c) { if (!el.querySelector('.cover img')) el.querySelector('.cover').innerHTML = coverInner(c, b.lang); }
    else loadCoverInto(b, el.querySelector('.cover'));
  });
}

let itemIdx = 0;
function itemHtml(b) {
  const i = itemIdx++;
  const cover = b.cover || (b.pid ? cachedCover(b.pid) : '') || withIsbnCovers('', b.isbn);
  const approx = b.pid && !b.exact ? '約' : '';
  const n = b.lang === 'en' && b.count ? `${approx}${fmt(b.count)}語` : '';
  return `<button class="item" data-i="${i}">
    <div class="cover">${coverInner(cover, b.lang)}</div>
    <div class="grow"><div class="t"><span class="tag ${b.lang}">${b.lang === 'en' ? '英' : '日'}</span>${esc(b.title)}</div><div class="a">${esc(b.author || '')}${bookAgeText(b) ? '・' + bookAgeText(b) : b.gr ? '・' + esc(b.gr) : ''}</div></div>
    <div class="n ${b.lang}">${n}</div></button>`;
}

let searchCtl = null, searchTimer = null;
function onSearch() {
  const q = $('#searchInput').value.trim();
  clearTimeout(searchTimer);
  searchCtl?.abort();
  if (!q) { itemIdx = 0; renderSearchEmpty(); return; }
  itemIdx = 0;
  const presets = searchPresets(q, 30).filter((b) => langOk(b.lang)).slice(0, 15);
  // 出版社の目録（対象年齢つき）からも探す。リストにある本と同じものは除く
  if (langOk('ja')) {
    const have = new Set(presets.map((b) => b.isbn).filter(Boolean)); // 同じ本かどうかは ISBN だけで判断
    presets.push(...searchPub(q, 10).filter((b) => !have.has(b.isbn)));
  }
  if (langOk('en')) presets.push(...searchEnLib(q, 15)); // 洋書の語数リスト（本のリストと重ならない本だけが入っている）
  const base = presets.length ? '<div class="res-label">📚 登録済みの本</div>' + presets.map(itemHtml).join('') : '';
  setResults(base + '<div class="res-label">🔎 ほかの本を検索中…</div>', [...presets]);
  searchTimer = setTimeout(async () => {
    searchCtl = new AbortController();
    try {
      const web = shareTargets(await searchGoogleBooks(q, searchCtl.signal));
      // ネット検索の結果も、同じ本かどうかは ISBN だけで判断。ISBN のない結果は出さない
      await Promise.all([loadPubAges(), loadEnLib()]);
      const seen = new Set(presets.map((p) => p.isbn).filter(Boolean));
      const extra = web.filter((b) => /^97[89]\d{10}$/.test(b.isbn || '') && !seen.has(b.isbn) && !PRESET_BOOKS.some((x) => x.isbn === b.isbn))
        .filter((b, i, all) => all.findIndex((x) => x.isbn === b.isbn) === i).map((b) => {
        const lib = enLibBook(b.isbn); // 洋書の語数リストにある本なら語数・年齢つきで
        if (lib) return { ...b, ...lib, title: lib.title || b.title, cover: b.cover };
        const pa = pubAge(b.isbn); // 出版社の目録にある日本語の本なら年齢つきで
        if (pa) return { ...b, lang: 'ja', tgt: pa.label, tgtAge: pa.age };
        return b;
      }).filter((b) => langOk(b.lang));
      itemIdx = presets.length;
      const html = base + (extra.length ? '<div class="res-label">🔎 その他の本（語数は手入力）</div>' + extra.map(itemHtml).join('') : (presets.length ? '' : '<p class="muted center">見つかりませんでした。手入力で登録できます。</p>'));
      setResults(html, [...presets, ...extra]);
    } catch (e) {
      if (e.name !== 'AbortError') setResults(base || '<p class="muted center">検索できませんでした。手入力で登録できます。</p>', [...presets]);
    }
  }, 450);
}

function pickBook(b) {
  picked = { title: b.title, author: b.author || '', cover: b.cover || (b.pid ? cachedCover(b.pid) || '' : ''), isbn: b.isbn || '', lang: b.lang || 'en', count: b.count || 0, pid: b.pid || '', exact: !!b.exact, published: !!b.published, tgt: b.tgt || '', tgtAge: b.tgtAge ?? null };
  editing = null;
  showForm();
}

function showForm() {
  const b = picked;
  $('#addTitle').textContent = editing ? '記録を編集' : '読んだ本を記録';
  $('#addSearchView').hidden = true; $('#bookForm').hidden = false;
  $('#formCover').innerHTML = coverInner(withIsbnCovers(b.cover, b.isbn), b.lang);
  $('#fTitle').value = b.title; $('#fAuthor').value = b.author || '';
  const fl = langMode() === 'both' ? b.lang : langMode();
  document.querySelector(`input[name=fLang][value=${fl}]`).checked = true;
  $('#fWords').value = b.lang === 'en' && b.count ? b.count : '';
  $('#fChars').value = b.lang === 'ja' && b.count ? b.count : '';
  $('#wordHint').textContent = b.count ? '' : '（わかる場合は入力）'; // 語数の出どころは画面に出さない
  fillAgeField(b, editing);
  // 出版社の対象年齢の一覧がまだなら、読み込んでから自動の年齢を入れ直す（自分で選び直していたら触らない）
  if (b.lang === 'ja' && b.isbn && !pubAge(b.isbn)) {
    loadPubAges().then(() => { if (picked === b && pubAge(b.isbn) && $('#fAge').value === $('#fAge').dataset.auto) fillAgeField(b, editing); });
  }
  $('#fDate').value = editing?.date || addDate;
  $('#fTimes').value = editing?.times || 1;
  $('#deleteLog').hidden = !editing;
  langFields();
  renderChildPick(editing?.childId);
}

// 記録画面の「対象年齢」：分かっている年齢を自動で選び、分からなければ自分で選べる
function knownAge(b) {
  const p = b.pid ? PRESET_BY_PID.get(b.pid) : null;
  const pa = pubAge(b.isbn || p?.isbn); // 出版社サイトの対象年齢
  if (pa) return { age: pa.age, label: pa.label };
  if (b.tgtAge != null) return { age: b.tgtAge, label: b.tgt };
  if (p?.tgtAge != null) return { age: p.tgtAge, label: p.tgt };
  if (b.lang === 'ja' && p?.age != null) return { age: jaAgeNum(p.age), label: jaAge(p.age) + '（目安）' };
  if (b.lang === 'en' && p?.lv != null && !/Bookworms/.test(p.gr || '')) return { age: enAgeNum(p.lv), label: enAge(p.lv) + '（目安）' };
  return null;
}
function fillAgeField(b, log) {
  const opts = ['<option value="">わからない</option>'];
  for (let a = 0; a <= 12; a++) opts.push(`<option value="${a}">${a}歳〜</option>`);
  $('#fAge').innerHTML = opts.join('');
  const k = log?.tgtAge != null ? { age: log.tgtAge, label: log.tgt } : knownAge(b);
  $('#fAge').value = k ? String(Math.round(k.age)) : '';
  $('#fAge').dataset.auto = k ? String(Math.round(k.age)) : '';
  $('#ageHint').textContent = k ? '' : '（わかる場合は選択）'; // 年齢は選択欄に出ているので、横には出さない
}

function langFields() {
  const lang = document.querySelector('input[name=fLang]:checked').value;
  $('#enFields').hidden = lang !== 'en'; $('#jaFields').hidden = true; // 日本語は冊数だけ記録
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

function ageFromForm() {
  const v = $('#fAge').value;
  if (v === '') return { tgt: '', tgtAge: null };
  if (v === $('#fAge').dataset.auto) {
    const k = editing?.tgtAge != null ? { age: editing.tgtAge, label: editing.tgt } : knownAge(picked || {});
    return { tgt: k?.label || `${v}歳〜`, tgtAge: k?.age ?? +v };
  }
  return { tgt: `${v}歳〜（手入力）`, tgtAge: +v };
}

function saveForm(e) {
  e.preventDefault();
  const lang = document.querySelector('input[name=fLang]:checked').value;
  const count = lang === 'en' ? Math.max(0, parseInt($('#fWords').value, 10) || 0) : 0;
  const now = Date.now();
  const data = {
    childId: pickedChild || children()[0].id,
    date: $('#fDate').value || todayStr(),
    lang, title: $('#fTitle').value.trim() || '（無題）', author: $('#fAuthor').value.trim(),
    cover: picked?.cover || '', isbn: picked?.isbn || '', pid: picked?.pid || '',
    ...ageFromForm(),
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
      const [b0] = await Promise.all([lookupIsbn(isbn), loadEnLib()]);
      // ネットの書誌で見つからなくても、本のリストか洋書の語数リストにISBNがあればその本にする
      const known = PRESET_BOOKS.find((x) => x.isbn === isbn) || enLibBook(isbn);
      const b = b0 || (known ? { title: known.title, author: known.author || '', isbn, lang: known.lang, cover: withIsbnCovers('', isbn) } : null);
      $('#scanDlg').close();
      if (!b) {
        toast('本が見つかりませんでした。手入力してください');
        pickBook({ title: '', isbn, lang: 'en' });
        return;
      }
      // ISBNで本のリスト → 洋書の語数リストの順に探し、なければ書名で探す
      await loadEnLib();
      const p = PRESET_BOOKS.find((x) => x.isbn === isbn); // 同じ本かどうかは ISBN だけで判断
      const lib = !p && enLibBook(isbn);
      if (lib) { pickBook({ ...b, ...lib, title: lib.title || b.title, cover: withIsbnCovers(b.cover, isbn) }); return; }
      // リストにある本なら、リストの表紙（取得済み）を先頭に
      const pc = p ? cachedCover(p.pid) : '';
      pickBook(p ? { ...b, count: p.count, pid: p.pid, lang: p.lang, cover: withIsbnCovers([pc, b.cover].filter(Boolean).join('|'), isbn) } : b);
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
  return { only: langMode() === 'both' ? '' : langMode(), year: viewY, month: viewM + 1, name, enWords: m.en, jaBooks: m.jaBooks, jaChars: m.jaChars, totalEn: aggregate(logs).en, totalJa: aggregate(logs).jaBooks, readDays: days.size, days };
}
async function drawShare() {
  const d = shareData();
  await renderShareImage($('#shareCanvas'), d);
  const body = d.only === 'ja' ? `日本語 ${fmt(d.jaBooks)}冊（累計 ${fmt(d.totalJa)}冊）`
    : d.only === 'en' ? `英語 ${fmt(d.enWords)}語（累計 ${fmt(d.totalEn)}語）`
    : `日本語 ${fmt(d.jaBooks)}冊、英語 ${fmt(d.enWords)}語（累計 ${fmt(d.totalEn)}語）`;
  const text = `${d.month}月の読書きろく：${body}📚\n#${CONFIG.hashtags.join(' #')}`;
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
      <label class="adult" title="大人の英語学習者"><input type="checkbox" class="is-adult" ${c.adult ? 'checked' : ''}>大人</label>
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
  // モデルケースは1人だけ。追加済みなら、消すときは上の🗑から
  $('#modelBtn').textContent = '⭐ モデルケース（5歳〜10歳の5年分の見本）を追加';
  $('#modelBtn').hidden = children().some((c) => c.model);
}

// ---------------- モデルケース（見本データ）を作る ----------------
// 5歳から10歳まで5年分（自分で読み始める年齢から）。年齢が上がるにつれて読む本の対象年齢も上がり、
// ときどき下の年齢向けの本（お気に入りの読み返しなど）もはさむ。
function genModel(childId) {
  const idp = 'm' + uid();
  let seed = 20211108;
  const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  // リストの本を対象年齢ごとに分けておく（英語は語数が分かる本を優先）
  const pool = { ja: new Map(), en: new Map() };
  for (const b of PRESET_BOOKS) {
    const k = knownAge(b); if (!k || /平均/.test(b.title)) continue;
    if (b.lang === 'en' && b.gr && /Bookworms|Penguin|Cambridge|Macmillan|Pearson/i.test(b.gr)) continue;
    const a = Math.round(k.age), m = pool[b.lang];
    if (!m.has(a)) m.set(a, []);
    m.get(a).push({ b, k });
  }
  for (const m of Object.values(pool)) for (const [a, list] of m) {
    const withCount = list.filter((x) => x.b.count > 0);
    if (withCount.length >= 4) m.set(a, withCount); // 英語は語数が分かる本だけにして、語数グラフも見本らしく
  }
  const nearest = (lang, want) => {
    const m = pool[lang]; const ages = [...m.keys()];
    const a = ages.reduce((best, x) => (Math.abs(x - want) < Math.abs(best - want) ? x : best), ages[0]);
    return pick(m.get(a));
  };
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end.getFullYear() - 5, end.getMonth(), end.getDate());
  const logs = []; let n = 0; const now = Date.now();
  const favs = { ja: [], en: [] };
  let enBusy = 0; // 長い本を読んでいる間（1日2,500語くらいのペース）は次の英語の本に進まない
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const years = (d - start) / (365.25 * 864e5); // 0〜5
    const childAge = 5 + years;
    const add = (lang, want) => {
      let x;
      if (favs[lang].length && rnd() < 0.12) x = pick(favs[lang]); // お気に入りを読み返す
      else if (rnd() < 0.18) x = nearest(lang, Math.max(0, want - 1 - Math.floor(rnd() * 2))); // ときどき易しい本
      else x = nearest(lang, Math.max(0, want + (rnd() - 0.5) * 1.6));
      if (rnd() < 0.15) { favs[lang].push(x); if (favs[lang].length > 12) favs[lang].shift(); }
      const { b, k } = x;
      logs.push({
        id: idp + (++n), childId, date: ymd(d), lang, title: b.title, author: b.author || '',
        cover: b.cover || '', isbn: b.isbn || '', pid: b.pid || '', tgt: k.label || '', tgtAge: k.age,
        count: lang === 'en' ? b.count || 0 : 0, times: 1, createdAt: now, updatedAt: now, demo: true,
      });
      if (lang === 'en') enBusy = Math.ceil((b.count || 0) / 2500);
    };
    // 日本語：毎日のように1冊、ときどき2冊。最初はやさしめで、そこからぐんぐん伸びる
    const jaWant = 3.8 + years * 1.25;
    if (rnd() < 0.6) { add('ja', jaWant); if (rnd() < 0.25) add('ja', jaWant); }
    // 英語：小さいころからのおうち英語で最初は日本語より上。伸びはゆるやかで、2年目ごろに日本語に追い越される
    if (enBusy > 0) enBusy--;
    else if (rnd() < 0.45 + years * 0.05) {
      const want = 5 + years * 0.5;
      add('en', want); if (rnd() < 0.2) add('en', want);
    }
  }
  return logs;
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
  $('#manualBtn').onclick = () => pickBook({ title: $('#searchInput').value.trim(), lang: /^[\x20-\x7e]+$/.test($('#searchInput').value.trim()) ? 'en' : 'ja' });
  $('#scanBtn').onclick = openScan;
  $('#backBtn').onclick = () => { if (editing) { $('#addDlg').close(); editing = null; } else showSearch(); };
  document.querySelectorAll('input[name=fLang]').forEach((r) => r.addEventListener('change', () => {
    picked.lang = r.value; langFields(); $('#formCover').innerHTML = coverInner(picked.cover, picked.lang);
  }));
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

  $('#ageChart').addEventListener('pointermove', showAgeTip);
  $('#ageChart').addEventListener('click', showAgeTip);
  $('#ageChart').addEventListener('pointerleave', () => { $('#ageTip').hidden = true; $('#ageChart .cross')?.remove(); });
  $('#historyCard').addEventListener('toggle', renderHistory);
  $('#historySearch').addEventListener('input', () => { historyLimit = 30; renderHistory(); });
  $('#historyLang').onclick = (e) => {
    const b = e.target.closest('[data-l]'); if (!b) return;
    historyLang = b.dataset.l; historyLimit = 30;
    $('#historyLang').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    renderHistory();
  };
  $('#historyMore').onclick = () => { historyLimit += 30; renderHistory(); };
  // 一覧の本をタップすると、もう一度読んだ記録として登録画面を開く
  $('#historyList').onclick = (e) => {
    const it = e.target.closest('[data-h]'); if (!it) return;
    const h = $('#historyList')._items[+it.dataset.h];
    openAdd(todayStr());
    pickBook({ title: h.title, author: h.author, cover: h.cover, isbn: h.isbn, lang: h.lang, count: h.lang === 'en' ? h.count : 0, pid: h.pid, exact: !!PRESET_BY_PID.get(h.pid)?.exact });
  };
  $('#chartTabs').addEventListener('change', (e) => { chartMode = e.target.value; renderChart(); });
  $('#enChart').addEventListener('pointermove', showChartTip);
  $('#enChart').addEventListener('click', showChartTip);
  $('#enChart').addEventListener('pointerleave', () => { $('#chartTip').hidden = true; });
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
    state.children.push({ id: 'c' + uid(), name: `メンバー${children().length + 1}`, emoji: emojis[children().length % emojis.length], updatedAt: Date.now() });
    commit(); renderSettings();
  };
  $('#childList').addEventListener('change', (e) => {
    const row = e.target.closest('.child-row'); if (!row) return;
    const c = children().find((x) => x.id === row.dataset.cid);
    c.name = row.querySelector('.name').value.trim() || c.name;
    c.emoji = row.querySelector('.emoji').value.trim() || c.emoji;
    c.adult = row.querySelector('.is-adult').checked;
    c.updatedAt = Date.now(); commit();
  });
  $('#childList').addEventListener('click', (e) => {
    if (!e.target.closest('.del')) return;
    const row = e.target.closest('.child-row');
    const c = children().find((x) => x.id === row.dataset.cid);
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
  $('#modelBtn').onclick = () => {
    if (children().some((c) => c.model)) return;
    const c = { id: 'c' + uid(), name: 'モデル', emoji: '⭐', model: true, updatedAt: Date.now() };
    const logs = genModel(c.id);
    state.children.push(c); state.logs.push(...logs);
    state.settings.activeChild = c.id; ageRange = 'all';
    const r = document.querySelector('input[name=ageRange][value=all]'); if (r) r.checked = true;
    viewY = today.getFullYear(); viewM = today.getMonth();
    commit(); renderSettings(); $('#setDlg').close();
    toast(`⭐ 「モデル」に5年分の記録（${logs.length}件）を追加しました`);
  };
  $('#langModeSeg').addEventListener('change', (e) => {
    state.settings.langMode = e.target.value; commit();
    toast(e.target.value === 'ja' ? '日本語だけ表示します' : e.target.value === 'en' ? '英語だけ表示します' : '日本語と英語を表示します');
  });
  $('#ageTabs').addEventListener('change', (e) => { ageRange = e.target.value; renderAgeChart(); });
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

// リスト外の英語の本で、出版社の対象がまだ分からない記録は、別の版から対象を探して補う（1回あたり数冊まで）
async function backfillTargets() {
  // 出版社サイトの対象年齢：ISBNが分かる日本語の記録で、年齢が入っていない・目安だけのものを埋める
  await loadPubAges();
  let pubFilled = false;
  for (const l of state.logs) {
    if (l.deleted || /手入力/.test(l.tgt || '')) continue; // 自分で選んだ年齢はそのまま
    const pa = pubAge(l.isbn || PRESET_BY_PID.get(l.pid)?.isbn);
    if (pa && (l.tgtAge == null || !/（[^）]*(?:書店|社|館)）$/.test(l.tgt || '')) && l.tgt !== pa.label) {
      l.tgt = pa.label; l.tgtAge = pa.age; l.updatedAt = Date.now(); pubFilled = true;
    }
  }
  // 洋書：ISBNが分かる記録で語数が0のものに、洋書の語数リストの語数を入れる（自分で入れた語数はそのまま）
  await loadEnLib();
  for (const l of state.logs) {
    if (l.deleted || l.lang !== 'en' || l.count || !l.isbn) continue;
    const lib = enLibBook(l.isbn) || PRESET_BOOKS.find((x) => x.isbn === l.isbn && x.count);
    if (lib?.count) { l.count = lib.count; l.updatedAt = Date.now(); pubFilled = true; }
  }
  if (pubFilled) commit();
  // 以前の学年表記（「小1〜小3」など）で保存した対象を、年齢表記に直す
  let migrated = false;
  for (const l of state.logs) {
    // シリーズの年齢を見直したとき（例：Mercy Watson 6〜9歳の目安 → 5〜8歳の出版社の対象）も、記録の表記をそろえる
    if (l.tgt && !/手入力/.test(l.tgt)) {
      const t = seriesTarget(l.tgt);
      if (t && t.label !== l.tgt && (/小\d|プレスクール|年長/.test(l.tgt) || l.tgt.split('：')[0] === t.label.split('：')[0])) {
        l.tgt = t.label; l.tgtAge = t.age; l.updatedAt = Date.now(); migrated = true;
      }
    }
  }
  if (migrated) commit();
  const todo = state.logs.filter((l) => !l.deleted && l.lang === 'en' && !l.pid && !l.tgt && !l.tgtChecked).slice(0, 5);
  let changed = false;
  for (const l of todo) {
    try {
      const core = l.title.replace(/[（(][^）)]*[）)]/g, ' ').split(/[:：]/).pop().trim() || l.title;
      const list = shareTargets([{ ...l, tgt: '' }, ...(await searchGoogleBooks(`intitle:${core}`))]);
      const keys = new Set(titleKeys(l.title));
      const hit = list.find((b) => b.tgt && titleKeys(b.title).some((k) => keys.has(k)));
      if (hit) { l.tgt = hit.tgt; l.tgtAge = hit.tgtAge; }
      l.tgtChecked = true; l.updatedAt = Date.now(); changed = true;
    } catch { break; } // 通信できない時は次回に回す
  }
  if (changed) commit();
}

bind();
render();
setTimeout(backfillTargets, 1500);
updateSyncUi(sync.linked ? 'stale' : 'off');
autoHeight();
