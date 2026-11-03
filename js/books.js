// ============================================================
//  本の検索・ISBN照会・表紙・アフィリエイトリンク
//  （openBD / Google Books の無料APIを利用者のブラウザから直接呼び出し）
// ============================================================
import { CONFIG } from './config.js';
import { PRESET_BOOKS } from './books-db.js';

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

export async function searchGoogleBooks(q, signal) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=12&printType=books`;
  const r = await fetch(url, { signal });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.items || []).map(mapGoogle).filter((b) => b.title);
}

// バーコード(ISBN)から本を探す：openBD → Google Books の順
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
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const j = await r.json();
    if (j.items?.length) return { ...mapGoogle(j.items[0]), isbn };
  } catch { /* 見つからず */ }
  return null;
}

// プリセット本の表紙を Google Books から探してキャッシュ
const COVER_KEY = 'tadoku-cover-cache';
let coverCache = {};
try { coverCache = JSON.parse(localStorage.getItem(COVER_KEY) || '{}'); } catch { coverCache = {}; }
const inflight = new Map();

export function cachedCover(pid) { return coverCache[pid]; }

export function fetchPresetCover(book) {
  if (book.pid in coverCache) return Promise.resolve(coverCache[book.pid]);
  if (/（1冊|\(1冊/.test(book.title)) { coverCache[book.pid] = ''; return Promise.resolve(''); }
  if (inflight.has(book.pid)) return inflight.get(book.pid);
  const title = book.title.replace(/[（(].*?[)）]/g, '').trim();
  const author = book.author.split(/[\/,]/)[0].trim();
  const q = `intitle:${title}` + (author ? `+inauthor:${author}` : '');
  const p = searchGoogleBooks(q)
    .then((list) => {
      const c = list.find((b) => b.cover)?.cover || '';
      coverCache[book.pid] = c;
      try { localStorage.setItem(COVER_KEY, JSON.stringify(coverCache)); } catch { /* 容量オーバーは無視 */ }
      return c;
    })
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
