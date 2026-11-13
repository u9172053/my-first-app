// ============================================================
//  本の検索・ISBN照会・表紙・アフィリエイトリンク
//  （openBD / Google Books の無料APIを利用者のブラウザから直接呼び出し）
// ============================================================
import { CONFIG } from './config.js';
import { PRESET_BOOKS, COVER_QUERY } from './books-db.js';

import { norm } from './norm.js';
export { norm };

export function searchPresets(q, limit = 20) {
  const n = norm(q);
  if (!n) return [];
  const scored = [];
  for (const b of PRESET_BOOKS) {
    // 正規化した文字列は初回だけ作って使い回す（1000冊以上あるので）
    b._n ??= [norm(b.title), norm(b.author), norm(b.series)];
    const [t, a, s] = b._n;
    let score = -1;
    if (t.startsWith(n) || (b.lbl && norm(b.lbl).startsWith(n))) score = 3; // 「ORT」などシリーズ名の略称でも先頭に
    else if (t.includes(n)) score = 2;
    else if (s.includes(n)) score = 1.5;
    else if (a.includes(n)) score = 1;
    // 定番の本と、読んだ人が多い本を上に
    if (score >= 0) scored.push([score + (b.classic ? 0.5 : 0) + Math.min(0.4, Math.log10((b.rl || 0) + 1) / 10), b]);
  }
  return scored.sort((x, y) => y[0] - x[0]).slice(0, limit).map((x) => x[1]);
}

export function findPresetByTitle(title) {
  const n = norm(title);
  if (!n) return null;
  return PRESET_BOOKS.find((b) => norm(b.title) === n) ||
    PRESET_BOOKS.find((b) => n.length > 5 && norm(b.title).startsWith(n)) || null;
}

// 国立国会図書館サーチの書影（日本の本向け。画像がなければ表示側で代わりのアイコンに切り替え）
// ---------------- 出版社が公表している対象年齢（日本語の本） ----------------
// data/ja-pub.json：[ISBN, 書名, 著者, 年齢, 表記] の一覧。大きいので必要になったときだけ読み込む
let pubRows = null, pubByIsbn = new Map(), pubLoading = null;
export function loadPubAges() {
  if (pubRows) return Promise.resolve(pubRows);
  return (pubLoading ||= fetch(new URL('../data/ja-pub.json', import.meta.url)).then((r) => r.json()).then((rows) => {
    pubRows = rows.map(([isbn, title, author, age, label]) => ({ isbn, title, author, age, label, key: norm(title) }));
    pubByIsbn = new Map(pubRows.map((r) => [r.isbn, r]));
    return pubRows;
  }).catch(() => { pubLoading = null; return []; }));
}
export const pubAge = (isbn) => pubByIsbn.get(isbn) || null;
// 書名で探す（リストにない本の検索結果に出す）
export function searchPub(q, n = 10) {
  if (!pubRows) return [];
  const k = norm(q); if (!k) return [];
  const hits = pubRows.filter((r) => r.key.includes(k));
  hits.sort((a, b) => (a.key.startsWith(k) ? 0 : 1) - (b.key.startsWith(k) ? 0 : 1) || a.key.length - b.key.length);
  return hits.slice(0, n).map((r) => ({ title: r.title, author: r.author, isbn: r.isbn, lang: 'ja', tgt: r.label, tgtAge: r.age, cover: '' }));
}

// ---------------- 洋書の語数リスト（日本多読学会の語数リストのうち、本のリストにない本） ----------------
// data/en-lib.json：[ISBN, 書名, シリーズ, 語数, YL下, YL上, 対象年齢, 表記, 著者]。必要になったときだけ読み込む
let enRows = null, enByIsbn = new Map(), enLoading = null;
// 同じ作品の別の版（Open Library の作品で判定）：{ISBN: 作品の番号}。検索結果で同じ作品を1行にまとめるのに使う
let worksMap = {};
export const workOf = (isbn) => worksMap[isbn] || null;
export function loadEnLib() {
  if (enRows) return Promise.resolve(enRows);
  fetch(new URL('../data/en-works.json', import.meta.url)).then((r) => r.json()).then((w) => { worksMap = w; }).catch(() => {});
  return (enLoading ||= fetch(new URL('../data/en-lib.json', import.meta.url)).then((r) => r.json()).then((rows) => {
    enRows = rows.map(([isbn, title, series, count, y0, y1, age, label, author]) => ({ isbn, title, series, count, yl: [y0, y1], age, label, author: author || '', key: norm(title) }));
    enByIsbn = new Map(enRows.map((r) => [r.isbn, r]));
    return enRows;
  }).catch(() => { enLoading = null; return []; }));
}
const enBook = (r) => ({ title: r.title, author: r.author, series: r.series, isbn: r.isbn, lang: 'en', count: r.count, exact: true, tgt: r.label || '', tgtAge: r.age, lbl: r.series, cover: '' });
export const enLibReady = () => !!enRows;
export const pubReady = () => !!pubRows;
export const enLibBook = (isbn) => { const r = enByIsbn.get(isbn); return r ? enBook(r) : null; };
export function searchEnLib(q, n = 15) {
  if (!enRows) return [];
  const k = norm(q); if (k.length < 2) return [];
  const hits = enRows.filter((r) => r.key.includes(k) || norm(r.series).includes(k) || norm(r.author).includes(k));
  hits.sort((a, b) => (a.key.startsWith(k) ? 0 : 1) - (b.key.startsWith(k) ? 0 : 1) || a.key.length - b.key.length);
  return hits.slice(0, n).map(enBook);
}

// ISBNが分かる本の表紙候補をつなげる（先頭から順に試し、読めない・極小の画像なら次へ）
// 版元ドットコム(openBD) → 国立国会図書館 → Open Library（Google Books は検索で表紙が分かったときだけ先頭に入る）
export function withIsbnCovers(cover, isbn) {
  const list = String(cover || '').split('|').filter(Boolean);
  if (/^97[89]\d{10}$/.test(isbn || '')) {
    list.push(`https://cover.openbd.jp/${isbn}.jpg`, `https://ndlsearch.ndl.go.jp/thumbnail/${isbn}.jpg`,
      `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`);
  }
  return [...new Set(list)].join('|');
}

const ndlThumb = (isbn) => (/^97[89]\d{10}$/.test(isbn || '') ? `https://ndlsearch.ndl.go.jp/thumbnail/${isbn}.jpg` : '');

const isJapanese = (s = '') => /[぀-ヿ一-鿿]/.test(s);

import { seriesTarget, agesFromText, titleKeys, shareTargets } from './targets.js';
export { seriesTarget, agesFromText, titleKeys, shareTargets };

function mapGoogle(item) {
  const v = item.volumeInfo || {};
  const ids = v.industryIdentifiers || [];
  const isbn = ids.find((i) => i.type === 'ISBN_13')?.identifier || isbn10to13(ids.find((i) => i.type === 'ISBN_10')?.identifier);
  const cover = (v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || '').replace(/^http:/, 'https:') || ndlThumb(isbn);
  const title = [v.title, v.subtitle].filter(Boolean).join(': ');
  const desc = (v.description || '').slice(0, 2000);
  // シリーズのレベル（Step into Reading など）→ なければ説明文の「ages 5-8」などの出版社の記載
  const tg = seriesTarget(title, (v.authors || []).join(' '), (v.categories || []).join(' '), desc) || agesFromText(desc);
  return {
    title, author: (v.authors || []).join(', '), isbn, cover,
    lang: v.language === 'ja' || isJapanese(title) ? 'ja' : 'en',
    tgt: tg?.label || '', tgtAge: tg?.age ?? null,
  };
}

const gbKey = () => (CONFIG.googleBooksApiKey ? `&key=${encodeURIComponent(CONFIG.googleBooksApiKey)}` : '');

// Google Books 検索（失敗時は例外を投げる）
export async function searchGoogleBooks(q, signal) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=12&printType=books${gbKey()}`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error('googlebooks ' + r.status);
  const j = await r.json();
  return (j.items || []).map(mapGoogle).filter((b) => b.title);
}

// バーコード(ISBN)から本を探す：openBD → Google Books → Open Library の順
// 書誌の著者表記（「工藤,ノリコ,1970-」「中川李枝子／作」など）を、「工藤ノリコ」の形に整える
function cleanAuthor(a) {
  const t = String(a || '').replace(/,\s*\d{4}-?\d{0,4}/g, '').trim(); // 生年・没年を外す
  if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(t)) {
    return t.split(/\s+|[／/]/)[0].replace(/^([^,]+),\s*([^,]+)$/, '$1$2').replace(/[,，]\s*$/, ''); // 「工藤,ノリコ」→「工藤ノリコ」
  }
  return t.replace(/^([^,]+),\s*([^,]+)$/, '$2 $1'); // 「Rowling, J. K.」→「J. K. Rowling」
}
export async function lookupIsbn(isbn) {
  try {
    const r = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`);
    const j = await r.json();
    const s = j?.[0]?.summary;
    if (s?.title) {
      // openBD に表紙がない本は、Google Books の表紙を先頭に足す
      let g = '';
      if (!s.cover) { try { g = (await searchGoogleBooks(`isbn:${isbn}`))[0]?.cover || ''; } catch { /* なくてもOK */ } }
      if (g.includes('ndlsearch')) g = '';
      return { title: s.title, author: cleanAuthor(s.author), isbn, cover: withIsbnCovers(s.cover || g, isbn), lang: isJapanese(s.title) ? 'ja' : 'en' };
    }
  } catch { /* 次へ */ }
  try {
    const list = await searchGoogleBooks(`isbn:${isbn}`);
    if (list.length) return { ...list[0], isbn, cover: withIsbnCovers(list[0].cover, isbn) };
  } catch { /* 次へ */ }
  try {
    const r = await fetch(`https://openlibrary.org/search.json?isbn=${isbn}&limit=1&fields=title,author_name,cover_i,language`);
    const d = (await r.json()).docs?.[0];
    if (d?.title) {
      return {
        title: d.title, author: (d.author_name || []).join(', '), isbn,
        cover: withIsbnCovers(d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '', isbn),
        lang: (d.language || []).includes('jpn') || isJapanese(d.title) ? 'ja' : 'en',
      };
    }
  } catch { /* 見つからず */ }
  return null;
}

// ---------------- 表紙（プリセット本） ----------------
// 英語の本：Open Library（キー不要）→ Google Books
// 日本語の本：Google Books → Open Library
// 見つからなかった結果は7日間だけ覚えておき、通信エラーは覚えない
const COVER_KEY = 'tadoku-cover-cache-v5';
const MISS_TTL = 7 * 24 * 3600 * 1000;
let coverCache = {};
try { coverCache = JSON.parse(localStorage.getItem(COVER_KEY) || '{}'); } catch { coverCache = {}; }
try { ['tadoku-cover-cache', 'tadoku-cover-cache-v2', 'tadoku-cover-cache-v3', 'tadoku-cover-cache-v4'].forEach((k) => localStorage.removeItem(k)); } catch { /* 旧キャッシュ削除 */ }
const inflight = new Map();
const isGeneric = (title) => /（1冊|\(1冊/.test(title);

// 戻り値: URL文字列 / ''（表紙なし確定） / undefined（未取得）
const olCoverUrl = (id) => `https://covers.openlibrary.org/b/id/${id}-M.jpg`;

export function cachedCover(pid) {
  const b = PRESET_BOOKS.find((x) => x.pid === pid);
  if (b?.coverUrl) return b.coverUrl + (b.isbn ? `|search:${b.pid}` : '');
  if (b?.olCover) return olCoverUrl(b.olCover) + (b.isbn ? `|search:${b.pid}` : '');
  if (b?.coverIsbn) return isbnCoverList(b.coverIsbn, b.pid);
  const v = coverCache[pid];
  if (v === undefined) return undefined;
  if (typeof v === 'string') return v;
  if (Date.now() - v.miss < MISS_TTL) return '';
  return undefined;
}

function saveCovers() {
  try { localStorage.setItem(COVER_KEY, JSON.stringify(coverCache)); } catch { /* 容量オーバーは無視 */ }
}

async function openLibraryCover(title, author) {
  const u = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}` +
    (author ? `&author=${encodeURIComponent(author)}` : '') + '&limit=5&fields=cover_i';
  const r = await fetch(u);
  if (!r.ok) throw new Error('openlibrary ' + r.status);
  const d = (await r.json()).docs?.find((x) => x.cover_i);
  return d ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '';
}

// Google Books で探す。表紙画像がない時は、見つかった ISBN で
// openBD（版元ドットコムの書影）→ 国立国会図書館の書影 の順に探す（日本の絵本に強い）
async function googleCover(title, author) {
  let list = await searchGoogleBooks(`intitle:${title}` + (author ? ` inauthor:${author}` : ''));
  if (!list.length && author) list = await searchGoogleBooks(`intitle:${title}`);
  const hit = list.find((b) => b.cover);
  if (hit) return hit.cover;
  const isbns = [...new Set(list.map((b) => b.isbn).filter((i) => /^97[89]\d{10}$/.test(i)))].slice(0, 5);
  if (!isbns.length) return '';
  try {
    const r = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbns.join(',')}`);
    const c = (await r.json()).find((x) => x?.summary?.cover)?.summary.cover;
    if (c) return c;
  } catch { /* 次へ */ }
  return ndlThumb(isbns[0]);
}

// 同時に問い合わせる数を制限（相手サーバーに優しく）
let running = 0;
const waiting = [];
function limited(fn) {
  return new Promise((res, rej) => {
    const run = () => {
      running++;
      fn().then(res, rej).finally(() => { running--; waiting.shift()?.(); });
    };
    if (running < 3) run(); else waiting.push(run);
  });
}

// ISBN が分かっている本は通信なしで候補URLを並べる（読み込めなければ表示側で次の候補へ）
//   版元ドットコム(openBD) → 国立国会図書館 → Google Books
//   最後の「search:」は、Google Books で表紙があると確認できたものだけを探す（ISBN → 書名の完全一致）
export function isbnCoverList(isbn, pid) {
  if (!/^97[89]\d{10}$/.test(isbn || '')) return '';
  return [
    `https://cover.openbd.jp/${isbn}.jpg`,
    `https://ndlsearch.ndl.go.jp/thumbnail/${isbn}.jpg`,
    pid ? `search:${pid}` : `https://books.google.com/books/content?vid=ISBN${isbn}&printsec=frontcover&img=1&zoom=1`,
  ].join('|');
}

// Google Books で「本当に表紙画像がある」ものを探す（書名が完全一致するものだけ。別の版や似た本は使わない）
const strictCache = new Map();
export function searchCoverStrict(pid) {
  if (strictCache.has(pid)) return strictCache.get(pid);
  const book = PRESET_BOOKS.find((b) => b.pid === pid);
  if (!book) return Promise.resolve('');
  const title = (COVER_QUERY[book.series] && isGeneric(book.title)) ? COVER_QUERY[book.series][0] : book.title.replace(/[（(].*?[)）]/g, '').trim();
  const author = (book.author || '').split(/[\/,・]/)[0].trim();
  const real = (b) => b.cover && !b.cover.includes('ndlsearch');
  const p = (async () => {
    if (book.coverIsbn) {
      const hit = (await searchGoogleBooks(`isbn:${book.coverIsbn}`)).find(real);
      if (hit) return hit.cover;
    }
    let list = await searchGoogleBooks(`intitle:${title}` + (author ? ` inauthor:${author}` : ''));
    if (!list.some(real)) list = list.concat(await searchGoogleBooks(`intitle:${title}`));
    return list.find((b) => real(b) && norm(b.title) === norm(title))?.cover || '';
  })().catch(() => '');
  strictCache.set(pid, p);
  return p;
}

export function fetchPresetCover(book) {
  if (book.coverUrl) return Promise.resolve(book.coverUrl + (book.isbn ? `|search:${book.pid}` : ''));
  if (book.olCover) return Promise.resolve(olCoverUrl(book.olCover) + (book.isbn ? `|search:${book.pid}` : ''));
  if (book.coverIsbn) return Promise.resolve(isbnCoverList(book.coverIsbn, book.pid));
  const c = cachedCover(book.pid);
  if (c !== undefined) return Promise.resolve(c);
  let title, author;
  if (isGeneric(book.title)) {
    // シリーズ代表作の表紙を使う（代表作がないシリーズは表紙なし）
    const q = COVER_QUERY[book.series];
    if (!q) { coverCache[book.pid] = { miss: Date.now() }; return Promise.resolve(''); }
    [title, author] = q;
  } else {
    const base = book.title.replace(/[（(].*?[)）]/g, '').trim();
    title = base.replace(/^.*#\d+\s*/, '').trim() || base.replace(/\s*#\d+$/, '').trim();
    author = (book.author || '').split(/[\/,]/)[0].trim();
  }
  if (inflight.has(book.pid)) return inflight.get(book.pid);
  const order = book.lang === 'ja' ? [googleCover, openLibraryCover] : [openLibraryCover, googleCover];
  const p = limited(async () => {
    let allOk = true;
    for (const fn of order) {
      try {
        const url = await fn(title, author);
        if (url) return url;
      } catch { allOk = false; /* 次の取得元へ */ }
    }
    // どこかで通信エラーがあった時は「表紙なし」を覚えない（次回また探す）
    if (!allOk) throw new Error('network');
    return '';
  })
    .then((url) => { coverCache[book.pid] = url || { miss: Date.now() }; saveCovers(); return url; })
    .catch(() => '')
    .finally(() => inflight.delete(book.pid));
  inflight.set(book.pid, p);
  return p;
}

// ---------------- アフィリエイトリンク ----------------
// ISBN-10 → ISBN-13（978 を付けてチェック数字を計算し直す）
export function isbn10to13(i10) {
  if (!/^\d{9}[\dX]$/i.test(i10 || '')) return '';
  const core = '978' + i10.slice(0, 9);
  const sum = [...core].reduce((s, d, k) => s + (+d) * (k % 2 ? 3 : 1), 0);
  return core + ((10 - (sum % 10)) % 10);
}
function isbn13to10(isbn) {
  if (!/^978\d{10}$/.test(isbn)) return null;
  const core = isbn.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * +core[i];
  const c = (11 - (sum % 11)) % 11;
  return core + (c === 10 ? 'X' : String(c));
}

export function amazonUrl(book) {
  const tag = CONFIG.amazonTag ? `tag=${encodeURIComponent(CONFIG.amazonTag)}` : '';
  const isbn10 = book.isbn?.length === 10 ? book.isbn : isbn13to10(book.isbn || '');
  if (isbn10) return `https://www.amazon.co.jp/dp/${isbn10}/${tag ? '?' + tag : ''}`;
  const q = encodeURIComponent(`${book.title.replace(/[（(].*?[)）]/g, '')} ${book.author || ''}`.trim());
  return `https://www.amazon.co.jp/s?k=${q}${tag ? '&' + tag : ''}`;
}

// メルカリ：タイトルで検索した結果ページ（メルカリアンバサダーのIDを付ける）
export function mercariUrl(book) {
  const q = book.title.replace(/[（(].*?[)）]/g, '').replace(/[#＃]\s*\d+\s*/g, ' ').trim();
  const id = CONFIG.mercariAfid ? `&afid=${encodeURIComponent(CONFIG.mercariAfid)}` : '';
  return `https://jp.mercari.com/search?keyword=${encodeURIComponent(q)}${id}`;
}

export function rakutenUrl(book) {
  if (book.rkUrl) { // 楽天ブックスの商品ページが分かっている本は、そのページへのアフィリエイトリンク
    if (!CONFIG.rakutenAffiliateId) return book.rkUrl;
    const u = encodeURIComponent(book.rkUrl);
    return `https://hb.afl.rakuten.co.jp/hgc/${CONFIG.rakutenAffiliateId}/?pc=${u}&m=${u}`;
  }
  const q = book.isbn || `${book.title.replace(/[（(].*?[)）]/g, '')} ${book.author || ''}`.trim();
  const target = `https://books.rakuten.co.jp/search?sitem=${encodeURIComponent(q)}`;
  if (!CONFIG.rakutenAffiliateId) return target;
  const u = encodeURIComponent(target);
  return `https://hb.afl.rakuten.co.jp/hgc/${CONFIG.rakutenAffiliateId}/?pc=${u}&m=${u}`;
}
