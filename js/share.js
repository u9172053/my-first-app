// ============================================================
//  SNSシェア用の画像（1080×1350）を作成
// ============================================================
import { CONFIG } from './config.js';

const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Noto Sans CJK JP", "Yu Gothic", "Meiryo", sans-serif';
const C = { bg: '#fff8ee', card: '#ffffff', ink: '#3b2f2a', sub: '#8a7a70', en: '#2f7fd8', ja: '#ee8a2a', line: '#f0e2d0', accent: '#5bb48c' };
const fmt = (n) => Math.round(n).toLocaleString('ja-JP');

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/**
 * @param {object} d { year, month, name, enWords, jaBooks, jaChars, totalEn, totalJa, streak, days: Map(day->{en,jaBooks}) }
 */
export async function renderShareImage(canvas, d) {
  try { await document.fonts.load(`700 40px "M PLUS Rounded 1c"`); } catch { /* システムフォントで代用 */ }
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  // 水玉の飾り
  ctx.globalAlpha = 0.12;
  [[90, 110, 70, C.en], [990, 160, 90, C.ja], [960, 1240, 80, C.accent], [70, 1200, 60, C.ja]].forEach(([x, y, r, c]) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.fillStyle = C.sub; ctx.font = `700 34px ${FONT}`;
  ctx.fillText(`📚 ${CONFIG.appName}`, W / 2, 110);
  ctx.fillStyle = C.ink; ctx.font = `800 64px ${FONT}`;
  const head = `${d.year}年${d.month}月${d.name ? ' ' + d.name + 'の' : 'の'}読書きろく`;
  ctx.fillText(head, W / 2, 200);

  // 日本語カード（左）と英語カード（右）
  const cw2 = (W - 160 - 30) / 2;
  const card = (x, color, label, num, unit, sub, cw = cw2) => {
    roundRect(ctx, x, 250, cw, 330, 36); ctx.fillStyle = C.card; ctx.fill();
    const cx = x + cw / 2;
    ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.font = `700 38px ${FONT}`; ctx.fillText(label, cx, 315);
    let size = 104; ctx.font = `800 ${size}px ${FONT}`;
    while (ctx.measureText(num).width > cw - 110 && size > 56) { size -= 4; ctx.font = `800 ${size}px ${FONT}`; }
    const nw = ctx.measureText(num).width;
    ctx.fillText(num, cx - 22, 450);
    ctx.textAlign = 'left'; ctx.font = `800 44px ${FONT}`; ctx.fillText(unit, cx - 22 + nw / 2 + 8, 450);
    ctx.textAlign = 'center'; ctx.fillStyle = C.sub; ctx.font = `700 28px ${FONT}`; ctx.fillText(sub, cx, 525);
  };
  // 「日本語だけ」「英語だけ」の設定なら、その言語のカードを横いっぱいに
  if (d.only === 'ja') card(80, C.ja, 'にほんご', fmt(d.jaBooks), '冊', `累計 ${fmt(d.totalJa)}冊`, W - 160);
  else if (d.only === 'en') card(80, C.en, 'English', fmt(d.enWords), '語', `累計 ${fmt(d.totalEn)}語`, W - 160);
  else {
    card(80, C.ja, 'にほんご', fmt(d.jaBooks), '冊', `累計 ${fmt(d.totalJa)}冊`);
    card(80 + cw2 + 30, C.en, 'English', fmt(d.enWords), '語', `累計 ${fmt(d.totalEn)}語`);
  }

  // ミニカレンダー（週の数に合わせて行の高さを調整）
  const first = new Date(d.year, d.month - 1, 1).getDay();
  const days = new Date(d.year, d.month, 0).getDate();
  const rows = Math.ceil((first + days) / 7);
  const top = 650, cell = 120, left = (W - cell * 7) / 2, rowH = Math.min(84, 470 / rows);
  roundRect(ctx, 80, top - 20, W - 160, 570, 36); ctx.fillStyle = C.card; ctx.fill();
  const maxEn = Math.max(1, ...[...d.days.values()].map((v) => v.en));
  ctx.font = `700 26px ${FONT}`;
  ['日', '月', '火', '水', '木', '金', '土'].forEach((w, i) => { ctx.fillStyle = C.sub; ctx.fillText(w, left + cell * i + cell / 2, top + 26); });
  for (let day = 1; day <= days; day++) {
    const idx = first + day - 1, r = Math.floor(idx / 7), c = idx % 7;
    const x = left + c * cell + cell / 2, y = top + 50 + rowH * r + rowH / 2;
    const v = d.days.get(day);
    if (v && (v.en || v.jaBooks)) {
      const ratio = v.en ? Math.sqrt(v.en / maxEn) : 0;
      const rad = v.en ? 20 + 10 * ratio : 20;
      ctx.fillStyle = v.en ? C.en : C.ja;
      ctx.globalAlpha = v.en ? 0.45 + 0.55 * ratio : 0.8;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
    } else ctx.fillStyle = '#c9b9ac';
    ctx.font = `800 26px ${FONT}`; ctx.fillText(String(day), x, y + 9);
  }

  ctx.fillStyle = C.accent; ctx.font = `800 40px ${FONT}`;
  ctx.fillText(d.readDays ? `📖 ${d.month}月は ${d.readDays}日 読んだよ！` : '📖 コツコツ続けよう！', W / 2, 1270);
  footer(ctx, W, 1320);
}

// 画像のいちばん下：どこで記録しているか（見た人がたどり着けるように）
function footer(ctx, W, y) {
  ctx.textAlign = 'center'; ctx.fillStyle = C.sub; ctx.font = `700 28px ${FONT}`;
  ctx.fillText(`${CONFIG.siteName}「${CONFIG.appName}」で記録中`, W / 2, y);
}
function background(ctx, W, H) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.12;
  [[90, 110, 70, C.en], [990, 160, 90, C.ja], [960, 1240, 80, C.accent], [70, 1200, 60, C.ja]].forEach(([x, y, r, c]) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
}
// 文字を幅に収まるよう折り返す（最大 lines 行）
function wrap(ctx, text, maxW, lines) {
  const out = []; let cur = '';
  for (const ch of String(text)) {
    if (ctx.measureText(cur + ch).width > maxW) { out.push(cur); cur = ch; if (out.length === lines) break; } else cur += ch;
  }
  if (out.length < lines && cur) out.push(cur);
  if (out.length === lines && ctx.measureText(out[lines - 1]).width > maxW - 10) out[lines - 1] = out[lines - 1].slice(0, -1) + '…';
  return out;
}
// 表紙の画像を読み込む（候補を順に試す。別サイトの画像は CORS が許可されていないと画像に描けないので、だめなら null）
function loadCover(urls) {
  const list = String(urls || '').split('|').filter((u) => /^https?:/.test(u));
  return new Promise((res) => {
    const next = () => {
      const u = list.shift(); if (!u) return res(null);
      const img = new Image(); img.crossOrigin = 'anonymous'; img.referrerPolicy = 'no-referrer';
      const t = setTimeout(() => { img.src = ''; next(); }, 6000);
      img.onload = () => { clearTimeout(t); if (img.naturalWidth < 40) next(); else res(img); };
      img.onerror = () => { clearTimeout(t); next(); };
      img.src = u;
    };
    next();
  });
}

/**
 * 本棚：その月に読んだ本の表紙を並べた画像
 * @param {object} d { year, month, name, books: [{title, cover, lang}], jaBooks, enWords, enBooks, only }
 */
export async function renderShelfImage(canvas, d) {
  try { await document.fonts.load(`700 40px "M PLUS Rounded 1c"`); } catch { /* システムフォントで代用 */ }
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  background(ctx, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = C.sub; ctx.font = `700 34px ${FONT}`; ctx.fillText(`📚 ${CONFIG.appName}`, W / 2, 100);
  ctx.fillStyle = C.ink; ctx.font = `800 60px ${FONT}`;
  ctx.fillText(`${d.year}年${d.month}月${d.name ? ' ' + d.name + 'の' : 'の'}本棚`, W / 2, 185);
  const parts = [];
  if (d.only !== 'en' && d.jaBooks) parts.push(`日本語 ${fmt(d.jaBooks)}冊`);
  if (d.only !== 'ja' && d.enBooks) parts.push(`英語 ${fmt(d.enBooks)}冊・${fmt(d.enWords)}語`);
  ctx.fillStyle = C.accent; ctx.font = `800 38px ${FONT}`; ctx.fillText(parts.join('　') || 'まだ記録がありません', W / 2, 250);
  // 表紙のグリッド（冊数に合わせて 3〜5 列）
  const books = d.books.slice(0, 20);
  const cols = books.length <= 6 ? 3 : books.length <= 12 ? 4 : 5;
  const rows = Math.max(1, Math.ceil(books.length / cols));
  const gx = 70, gy = 300, gw = W - 140, gh = 960, gap = 22;
  const cw = (gw - gap * (cols - 1)) / cols, ch = Math.min(cw * 1.38, (gh - gap * (rows - 1)) / rows);
  const imgs = await Promise.all(books.map((b) => loadCover(b.cover)));
  books.forEach((b, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const x = gx + c * (cw + gap), y = gy + r * (ch + gap);
    ctx.save(); roundRect(ctx, x, y, cw, ch, 14); ctx.clip();
    const img = imgs[i];
    if (img) {
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, cw, ch);
      const s = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      ctx.drawImage(img, x + (cw - w) / 2, y + (ch - h) / 2, w, h);
    } else {
      // 表紙が使えない本は、色つきの本の形に書名を入れる
      ctx.fillStyle = b.lang === 'en' ? C.en : C.ja; ctx.fillRect(x, y, cw, ch);
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x, y, 10, ch);
      ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(cw / 7.5)}px ${FONT}`; ctx.textAlign = 'center';
      const lines = wrap(ctx, b.title, cw - 30, 4);
      const lh = Math.round(cw / 6.2), y0 = y + ch / 2 - (lines.length - 1) * lh / 2 + lh / 3;
      lines.forEach((t, k) => ctx.fillText(t, x + cw / 2 + 5, y0 + k * lh));
    }
    ctx.restore();
  });
  if (d.books.length > books.length) {
    ctx.fillStyle = C.sub; ctx.font = `700 30px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(`ほか ${d.books.length - books.length}冊`, W / 2, 1285);
  }
  footer(ctx, W, 1325);
}

/**
 * これまでの推移：始めた月から今月までの、英語の語数・日本語の冊数の累計（節目の印つき）
 * @param {object} g { start:'2022-04', end:'2026-11', months:[{key, y, m, en, ja}], totalEn, totalJa, enBooks, ms:[{key,lang,label}], only }
 */
export async function renderGrowthImage(canvas, g) {
  try { await document.fonts.load(`700 40px "M PLUS Rounded 1c"`); } catch { /* システムフォントで代用 */ }
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  background(ctx, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = C.sub; ctx.font = `700 34px ${FONT}`; ctx.fillText(`📚 ${CONFIG.appName}`, W / 2, 100);
  ctx.fillStyle = C.ink; ctx.font = `800 64px ${FONT}`; ctx.fillText('読書のあゆみ', W / 2, 190);
  const [sy, sm] = g.start.split('-').map(Number), [ey, em] = g.end.split('-').map(Number);
  const months = (ey - sy) * 12 + (em - sm) + 1;
  const span = months >= 12 ? `${Math.floor(months / 12)}年${months % 12 ? `${months % 12}か月` : ''}` : `${months}か月`;
  ctx.fillStyle = C.sub; ctx.font = `700 32px ${FONT}`; ctx.fillText(`${sy}年${sm}月〜${ey}年${em}月（${span}）`, W / 2, 245);
  const panels = [];
  if (g.only !== 'ja') panels.push({ lang: 'en', color: C.en, title: 'English', total: `${fmt(g.totalEn)}語`, sub: `${fmt(g.enBooks)}冊`, key: 'en' });
  if (g.only !== 'en') panels.push({ lang: 'ja', color: C.ja, title: 'にほんご', total: `${fmt(g.totalJa)}冊`, sub: '', key: 'ja' });
  const top = 290, bottom = 1240, gap = 30, ph = (bottom - top - gap * (panels.length - 1)) / panels.length;
  panels.forEach((p, k) => {
    const y0 = top + k * (ph + gap);
    roundRect(ctx, 70, y0, W - 140, ph, 36); ctx.fillStyle = C.card; ctx.fill();
    // 見出しと合計
    ctx.textAlign = 'left'; ctx.fillStyle = p.color; ctx.font = `800 36px ${FONT}`; ctx.fillText(p.title, 110, y0 + 62);
    ctx.textAlign = 'right'; ctx.fillStyle = C.ink; ctx.font = `800 58px ${FONT}`; ctx.fillText(p.total, W - 110, y0 + 70);
    if (p.sub) { ctx.fillStyle = C.sub; ctx.font = `700 28px ${FONT}`; ctx.fillText(p.sub, W - 110, y0 + 108); }
    // 折れ線（累計）
    const cx0 = 110, cx1 = W - 110, cy0 = y0 + 130, cy1 = y0 + ph - 60;
    const vals = g.months.map((m) => m[p.key]);
    const max = Math.max(1, vals[vals.length - 1]);
    const n = vals.length;
    const X = (i) => cx0 + (cx1 - cx0) * (n === 1 ? 1 : i / (n - 1));
    const Y = (v) => cy1 - (cy1 - cy0) * (v / max);
    ctx.beginPath(); ctx.moveTo(X(0), cy1);
    vals.forEach((v, i) => ctx.lineTo(X(i), Y(v)));
    ctx.lineTo(X(n - 1), cy1); ctx.closePath();
    ctx.globalAlpha = 0.14; ctx.fillStyle = p.color; ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); vals.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    ctx.strokeStyle = p.color; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx0, cy1); ctx.lineTo(cx1, cy1); ctx.stroke();
    // 横軸：始めた年と今年
    ctx.fillStyle = C.sub; ctx.font = `700 26px ${FONT}`;
    ctx.textAlign = 'left'; ctx.fillText(`${sy}年${sm}月`, cx0, cy1 + 38);
    ctx.textAlign = 'right'; ctx.fillText(`${ey}年${em}月`, cx1, cy1 + 38);
    // 節目の印（ラベルは重ならないものだけ）
    const placed = [];
    for (const m of g.ms.filter((x) => x.lang === p.lang).sort((a, b) => b.value - a.value)) {
      const i = g.months.findIndex((mm) => mm.key === m.date.slice(0, 7)); if (i < 0) continue;
      const x = X(i), y = Y(Math.min(m.value, max));
      ctx.fillStyle = '#fff'; ctx.strokeStyle = C.accent; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (placed.every((px) => Math.abs(px - x) > 190)) {
        placed.push(x);
        ctx.textAlign = x > cx1 - 120 ? 'right' : x < cx0 + 120 ? 'left' : 'center';
        ctx.font = `800 28px ${FONT}`; ctx.lineWidth = 8; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#2f7a55';
        ctx.strokeText(m.short, x, y - 24); ctx.fillText(m.short, x, y - 24);
      }
    }
  });
  ctx.textAlign = 'center';
  footer(ctx, W, 1305);
}

/**
 * 節目のお祝い（英語 10万語達成 など）
 * @param {object} m { label: '英語 100,000語', date: '2026-11-03', name, sub }
 */
export async function renderMilestoneImage(canvas, m) {
  try { await document.fonts.load(`700 40px "M PLUS Rounded 1c"`); } catch { /* システムフォントで代用 */ }
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  background(ctx, W, H);
  // 紙吹雪
  const conf = [C.en, C.ja, C.accent, '#f4c542', '#e86a8f'];
  for (let i = 0; i < 70; i++) {
    const x = (i * 157) % W, y = 60 + ((i * 263) % 520);
    ctx.save(); ctx.translate(x, y); ctx.rotate((i * 37) % 360 * Math.PI / 180);
    ctx.fillStyle = conf[i % conf.length]; ctx.globalAlpha = 0.7; ctx.fillRect(-9, -4, 18, 8); ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'center';
  ctx.fillStyle = C.sub; ctx.font = `700 34px ${FONT}`; ctx.fillText(`📚 ${CONFIG.appName}`, W / 2, 110);
  ctx.font = `160px ${FONT}`; ctx.fillText('🎉', W / 2, 420);
  roundRect(ctx, 90, 490, W - 180, 470, 40); ctx.fillStyle = C.card; ctx.fill();
  ctx.fillStyle = C.ink; ctx.font = `800 52px ${FONT}`;
  ctx.fillText(m.name ? `${m.name}が` : 'ついに', W / 2, 590);
  let size = 110; ctx.font = `800 ${size}px ${FONT}`;
  while (ctx.measureText(m.label).width > W - 260 && size > 60) { size -= 4; ctx.font = `800 ${size}px ${FONT}`; }
  ctx.fillStyle = m.lang === 'en' ? C.en : C.ja; ctx.fillText(m.label, W / 2, 740);
  ctx.fillStyle = C.ink; ctx.font = `800 64px ${FONT}`; ctx.fillText('達成！', W / 2, 850);
  const [y, mo, dd] = m.date.split('-').map(Number);
  ctx.fillStyle = C.sub; ctx.font = `700 32px ${FONT}`; ctx.fillText(`${y}年${mo}月${dd}日`, W / 2, 920);
  if (m.sub) { ctx.fillStyle = C.accent; ctx.font = `800 40px ${FONT}`; ctx.fillText(m.sub, W / 2, 1080); }
  footer(ctx, W, 1300);
}

export function canvasToFile(canvas, name = 'tadoku.png') {
  return new Promise((res) => canvas.toBlob((b) => res(new File([b], name, { type: 'image/png' })), 'image/png'));
}
