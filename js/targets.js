// ============================================================
//  シリーズのレベル別の対象年齢・出版社の説明文の対象年齢
//  （books.js と books-db.js の両方から使う）
// ============================================================
import { norm } from './norm.js';

// ---------------- シリーズのレベル別の対象年齢 ----------------
// 学年は年齢に換算（PreK＝4歳、K＝5歳、Grade 1＝6歳…。「Grade 1〜3」なら6〜9歳）
// ・Step into Reading（Random House 公表）：Step 1＝PreK〜K、2＝PreK〜Grade 1、3＝Grade 1〜3、4＝Grade 2〜3、5＝Grade 2〜4
// ・Ready-to-Read（Simon & Schuster 公表）：Pre-Level 1・Level 1＝3〜5歳、Level 2＝5〜7歳、Level 3＝6〜8歳
// ・Scholastic Reader（Scholastic のカタログ）：Level 1＝4〜8歳、Level 2＝6〜8歳
// ・I Can Read!（出版社は年齢・学年を公表していないため書店の目安）：Level 1＝PreK〜Grade 1、2＝Grade 1〜3、3＝Grade 2〜4、4＝Grade 3〜
// ・DK Super Readers（DK 公表）：Pre-Level＝3〜5歳
const T = (name, lo, hi, src) => ({ label: `${name}：${lo}〜${hi ?? ''}歳（${src}）`, age: lo });
const SERIES_TARGETS = [
  { re: /step\s*into\s*reading/i, level: /(?:step\s*into\s*reading\s+(?:step\s*)?|step\s*)([1-5])\b/i, map: {
    1: T('Step into Reading 1', 4, 6, '出版社の対象'), 2: T('Step into Reading 2', 4, 7, '出版社の対象'),
    3: T('Step into Reading 3', 6, 9, '出版社の対象'), 4: T('Step into Reading 4', 7, 9, '出版社の対象'),
    5: T('Step into Reading 5', 7, 10, '出版社の対象'),
  } },
  { re: /ready[-\s]*to[-\s]*read/i, level: /(pre-?\s*level\s*1|level\s*[1-3])\b/i, map: {
    'pre-level1': T('Ready-to-Read Pre-Level 1', 3, 5, '出版社の対象'), level1: T('Ready-to-Read Level 1', 3, 5, '出版社の対象'),
    level2: T('Ready-to-Read Level 2', 5, 7, '出版社の対象'), level3: T('Ready-to-Read Level 3', 6, 8, '出版社の対象'),
  } },
  { re: /scholastic\s*reader/i, level: /(level\s*[12])\b/i, map: {
    level1: T('Scholastic Reader Level 1', 4, 8, '出版社の対象'), level2: T('Scholastic Reader Level 2', 6, 8, '出版社の対象'),
  } },
  { re: /i\s*can\s*read/i, level: /(level\s*[1-4])\b/i, map: {
    level1: T('I Can Read! Level 1', 4, 7, '書店の目安'), level2: T('I Can Read! Level 2', 6, 9, '書店の目安'),
    level3: T('I Can Read! Level 3', 7, 10, '書店の目安'), level4: T('I Can Read! Level 4', 8, null, '書店の目安'),
  } },
  { re: /dk\s*super\s*readers/i, level: /(pre-?\s*level)\b/i, map: {
    'pre-level': T('DK Super Readers Pre-Level', 3, 5, '出版社の対象'),
  } },
];
// タイトル・副題・説明文などから、出版社が決めた対象を探す
export function seriesTarget(...texts) {
  const t = texts.filter(Boolean).join(' ');
  for (const s of SERIES_TARGETS) {
    if (!s.re.test(t)) continue;
    const m = t.match(s.level);
    if (!m) continue;
    const key = /^\d$/.test(m[1]) ? m[1] : m[1].toLowerCase().replace(/\s+/g, '').replace(/^pre-?level/, 'pre-level');
    if (s.map[key]) return s.map[key];
  }
  return null;
}

// 出版社の説明文にある「ages 5-8」「for ages 3 to 5」「Ages 4+」などの対象年齢
export function agesFromText(text) {
  const m = (text || '').match(/\bages?\s+(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})\b/i) || (text || '').match(/\bages?\s+(\d{1,2})\s*(\+|and up)/i);
  if (!m) return null;
  const lo = +m[1], hi = /^\d+$/.test(m[2]) ? +m[2] : null;
  if (lo > 18 || (hi != null && (hi < lo || hi > 18))) return null;
  return { label: hi != null ? `${lo}〜${hi}歳（出版社の説明）` : `${lo}歳〜（出版社の説明）`, age: lo };
}

// 同じ本の別の版を見分けるためのキー（かっこ書きを除いた全体と、「：」の後の書名部分）
export function titleKeys(title) {
  const base = (title || '').replace(/[（(][^）)]*[）)]/g, ' ');
  const keys = new Set([norm(base)]);
  const last = norm(base.split(/[:：]/).pop()); // 「シリーズ名: 書名」の書名の部分
  if (last.length >= 6) keys.add(last);
  return [...keys].filter(Boolean);
}
// 検索結果の中で、対象が分かっている版から、分からない版へ対象を引き継ぐ
export function shareTargets(list) {
  const known = new Map();
  for (const b of list) if (b.tgt) for (const k of titleKeys(b.title)) known.set(k, b);
  for (const b of list) {
    if (b.tgt || b.lang !== 'en') continue;
    const hit = titleKeys(b.title).map((k) => known.get(k)).find(Boolean);
    if (hit) { b.tgt = hit.tgt; b.tgtAge = hit.tgtAge; }
  }
  return list;
}

