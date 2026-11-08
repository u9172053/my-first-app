// 検索・照合用の文字列の正規化（全角半角・カタカナ→ひらがな・記号除去）
export const norm = (s = '') =>
  s.normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)) // カタカナ→ひらがな
    .replace(/[\s'’"“”.,!?！？・:：()（）\-–—&]/g, '');
