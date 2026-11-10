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
// ・Itty Bitty Princess Kitty（Little Simon）：5〜9歳（書店の目安）
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
  // シリーズ全体で対象年齢が決まっている本（レベル分けのないシリーズ）
  // 出版社が公表：Branches 5〜8歳（Scholastic）、Magic Tree House 6〜9歳、Geronimo Stilton 7〜10歳（Scholastic）、
  //   Captain Underpants 7歳〜（Scholastic）、Boxcar Children 6〜8歳、Ivy + Bean 6〜9歳（Chronicle）
  // 書店・紹介サイトの目安：Diary of a Wimpy Kid 8〜12歳、Elephant & Piggie 3〜8歳、Junie B. Jones・Mercy Watson・A to Z Mysteries 6〜9歳、
  //   Judy Moody 6〜10歳、Princess in Black 5〜8歳、Itty Bitty Princess Kitty 5〜9歳、Biscuit 3〜5歳
  { re: /owl\s*diaries|unicorn\s*diaries|dragon\s*masters|press\s*start!?|diary\s*of\s*a\s*pug|hilde\s*cracks|branches\s*book|scholastic\s*branches|tracey\s*west|rebecca\s*elliott/i, fixed: T('Branches', 5, 8, '出版社の対象') },
  { re: /magic\s*tree\s*house|mary\s*pope\s*osborne/i, fixed: T('Magic Tree House', 6, 9, '出版社の対象') },
  { re: /geronimo\s*stilton|thea\s*stilton/i, fixed: T('Geronimo Stilton', 7, 10, '出版社の対象') },
  { re: /scholastic\s*acorn|\bacorn\s*(book|reader)/i, fixed: T('Acorn', 4, 9, '出版社の対象') }, // Scholastic：Pre-K〜Grade 3 向け
  { re: /\bi\s*survived\b|lauren\s*tarshis/i, fixed: T('I Survived', 7, 10, '出版社の対象') }, // Scholastic の保護者向けページ：Ages 7–10
  { re: /captain\s*underpants/i, fixed: T('Captain Underpants', 7, null, '出版社の対象') },
  { re: /boxcar\s*children|gertrude\s*chandler\s*warner/i, fixed: T('Boxcar Children', 6, 8, '出版社の対象') },
  { re: /ivy\s*(\+|and|&)\s*bean/i, fixed: T('Ivy + Bean', 6, 9, '出版社の対象') },
  { re: /wimpy\s*kid|jeff\s*kinney/i, fixed: T('Diary of a Wimpy Kid', 8, 12, '書店などの目安') },
  { re: /elephant\s*(&|and)\s*piggie|elephant and piggie/i, fixed: T('Elephant & Piggie', 3, 8, '書店などの目安') },
  { re: /junie\s*b\.?\s*jones|barbara\s*park/i, fixed: T('Junie B. Jones', 6, 9, '書店などの目安') },
  { re: /mercy\s*watson/i, fixed: T('Mercy Watson', 5, 8, '出版社の対象') }, // Candlewick（販売元 Penguin Random House の Brightly）：Ages 5–8, Grades K–3
  { re: /nate\s*the\s*great|olivia\s*sharp/i, fixed: T('Nate the Great', 6, 9, '出版社の対象') }, // Penguin Random House（Brightly）：Ages 6–9
  { re: /oxford\s*reading\s*tree|\bORT\b/i, level: /(?:stage|level)\s*(1\+|\d{1,2})\b/i, map: {
    1: T('ORT Stage 1', 4, 5, 'Reception・出版社の目安'), '1+': T('ORT Stage 1+', 4, 5, 'Reception・出版社の目安'),
    2: T('ORT Stage 2', 4, 5, 'Reception・出版社の目安'), 3: T('ORT Stage 3', 4, 5, 'Reception・出版社の目安'),
    4: T('ORT Stage 4', 4, 6, 'Reception〜Year 1・出版社の目安'), 5: T('ORT Stage 5', 5, 6, 'Year 1・出版社の目安'),
    6: T('ORT Stage 6', 5, 6, 'Year 1・出版社の目安'), 7: T('ORT Stage 7', 5, 7, 'Year 1〜2・出版社の目安'),
    8: T('ORT Stage 8', 6, 8, 'Year 2〜3・出版社の目安'), 9: T('ORT Stage 9', 6, 8, 'Year 2〜3・出版社の目安'),
  } },
  { re: /a\s*to\s*z\s*mysteries|ron\s*roy/i, fixed: T('A to Z Mysteries', 6, 9, '書店などの目安') },
  { re: /judy\s*moody|megan\s*mcdonald/i, fixed: T('Judy Moody', 6, 10, '書店などの目安') },
  { re: /princess\s*in\s*black/i, fixed: T('The Princess in Black', 5, 8, '書店などの目安') },
  { re: /itty\s*bitty\s*princess\s*kitty/i, fixed: T('Itty Bitty Princess Kitty', 5, 9, '書店などの目安') },
  { re: /\bbiscuit\b|alyssa\s*satin\s*capucilli/i, fixed: T('Biscuit', 3, 5, '書店などの目安') }, // 書店の各巻の表記（Biscuit Finds a Friend 3〜5歳）。4〜8歳は I Can Read! 全体の表記なので使わない
  { re: /dk\s*super\s*readers/i, level: /(pre-?\s*level)\b/i, map: {
    'pre-level': T('DK Super Readers Pre-Level', 3, 5, '出版社の対象'),
  } },
];
// タイトル・副題・説明文などから、出版社が決めた対象を探す
export function seriesTarget(...texts) {
  const t = texts.filter(Boolean).join(' ');
  for (const s of SERIES_TARGETS) {
    if (!s.re.test(t)) continue;
    if (s.fixed) return s.fixed;
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

