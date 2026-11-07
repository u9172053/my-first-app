// ============================================================
//  SNSシェア用の画像（1080×1350）を作成
// ============================================================
import { CONFIG } from './config.js';

const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif';
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
  const cw = (W - 160 - 30) / 2;
  const card = (x, color, label, num, unit, sub) => {
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
  card(80, C.ja, 'にほんご', fmt(d.jaBooks), '冊', d.jaChars ? `約${fmt(d.jaChars)}字` : `累計 ${fmt(d.totalJa)}冊`);
  card(80 + cw + 30, C.en, 'English', fmt(d.enWords), '語', `累計 ${fmt(d.totalEn)}語`);

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
  ctx.fillStyle = C.sub; ctx.font = `700 28px ${FONT}`;
  ctx.fillText(CONFIG.hashtags.map((h) => '#' + h).join('  '), W / 2, 1320);
}

export function canvasToFile(canvas, name = 'tadoku.png') {
  return new Promise((res) => canvas.toBlob((b) => res(new File([b], name, { type: 'image/png' })), 'image/png'));
}
