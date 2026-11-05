// ============================================================
//  本の検索・ISBN照会・表紙・アフィリエイトリンク
//  （openBD / Google Books の無料APIを利用者のブラウザから直接呼び出し）
// ============================================================
import { CONFIG } from './config.js';
import { PRESET_BOOKS, COVER_QUERY } from './books-db.js';

export const norm = (s = '') =>
  s.normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)) // カタカナ→ひらがな
    .replace(/[\s'’"“”.,!?！？・:：()（）\-–—&]/g, '');

export function searchPresets(q, limit = 20) {
  const n = norm(q);
  if (!n) return [];
  const scored = [];
  for (const b of PRESET_BOOKS) {
    const t = norm(b.title), a = norm(b.author), s = norm(b.series);
    let score = -1;
    if (t.startsWith(n)) score = 3;
    else if (t.includes(n)) score = 2;
    else if (s.includes(n)) score = 1.5;
    else if (a.includes(n)) score = 1;
    if (score >= 0) scored.push([score, b]);
  }
  return scored.sort((x, y) => y[0] - x[0]).slice(0, limit).map((x) => x[1]);
}

export function findPresetByTitle(title) {
  const n = norm(title);
  if (!n) return null;
  return PRESET_BOOKS.find((b) => norm(b.title) === n) ||
    PRESET_BOOKS.find((b) => n.length > 5 && norm(b.title).startsWith(n)) || null;
}

const isJapanese = (s = '') => /[぀-ヿ一-鿿]/.test(s);

function mapGoogle(item) {
  const v = item.volumeInfo || {};
  const ids = v.industryIdentifiers || [];
  const isbn = (ids.find((i) => i.type === 'ISBN_13') || ids.find((i) => i.type === 'ISBN_10'))?.identifier || '';
  const cover = (v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || '').replace(/^http:/, 'https:');
  const title = [v.title, v.subtitle].filter(Boolean).join(': ');
  return {
    title, author: (v.authors || []).join(', '), isbn, cover,
    lang: v.language === 'ja' || isJapanese(title) ? 'ja' : 'en',
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
export async function lookupIsbn(isbn) {
  try {
    const r = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`);
    const j = await r.json();
    const s = j?.[0]?.summary;
    if (s?.title) {
      return { title: s.title, author: (s.author || '').replace(/／著.*$/, ''), isbn, cover: s.cover || '', lang: isJapanese(s.title) ? 'ja' : 'en' };
    }
  } catch { /* 次へ */ }
  try {
    const list = await searchGoogleBooks(`isbn:${isbn}`);
    if (list.length) return { ...list[0], isbn };
  } catch { /* 次へ */ }
  try {
    const r = await fetch(`https://openlibrary.org/search.json?isbn=${isbn}&limit=1&fields=title,author_name,cover_i,language`);
    const d = (await r.json()).docs?.[0];
    if (d?.title) {
      return {
        title: d.title, author: (d.author_name || []).join(', '), isbn,
        cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '',
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
const COVER_KEY = 'tadoku-cover-cache-v3';
const MISS_TTL = 7 * 24 * 3600 * 1000;
let coverCache = {};
try { coverCache = JSON.parse(localStorage.getItem(COVER_KEY) || '{}'); } catch { coverCache = {}; }
try { ['tadoku-cover-cache', 'tadoku-cover-cache-v2'].forEach((k) => localStorage.removeItem(k)); } catch { /* 旧キャッシュ削除 */ }
const inflight = new Map();
const isGeneric = (title) => /（1冊|\(1冊/.test(title);

// 戻り値: URL文字列 / ''（表紙なし確定） / undefined（未取得）
export function cachedCover(pid) {
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

async function googleCover(title, author) {
  const list = await searchGoogleBooks(`intitle:${title}` + (author ? ` inauthor:${author}` : ''));
  return list.find((b) => b.cover)?.cover || '';
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

export function fetchPresetCover(book) {
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
    author = book.author.split(/[\/,]/)[0].trim();
  }
  if (inflight.has(book.pid)) return inflight.get(book.pid);
  const order = book.lang === 'ja' ? [googleCover, openLibraryCover] : [openLibraryCover, googleCover];
  const p = limited(async () => {
    let anyOk = false;
    for (const fn of order) {
      try {
        const url = await fn(title, author);
        anyOk = true;
        if (url) return url;
      } catch { /* 次の取得元へ */ }
    }
    if (!anyOk) throw new Error('network');
    return '';
  })
    .then((url) => { coverCache[book.pid] = url || { miss: Date.now() }; saveCovers(); return url; })
    .catch(() => '')
    .finally(() => inflight.delete(book.pid));
  inflight.set(book.pid, p);
  return p;
}

// ---------------- アフィリエイトリンク ----------------
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

export function rakutenUrl(book) {
  const q = book.isbn || `${book.title.replace(/[（(].*?[)）]/g, '')} ${book.author || ''}`.trim();
  const target = `https://books.rakuten.co.jp/search?sitem=${encodeURIComponent(q)}`;
  if (!CONFIG.rakutenAffiliateId) return target;
  const u = encodeURIComponent(target);
  return `https://hb.afl.rakuten.co.jp/hgc/${CONFIG.rakutenAffiliateId}/?pc=${u}&m=${u}`;
}
