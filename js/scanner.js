// ============================================================
//  バーコード(ISBN)読み取り
//  Chrome/Android は標準の BarcodeDetector、iPhone 等は ZXing を必要な時だけ読み込み
// ============================================================
const ZXING_URL = 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js';

function loadZxing() {
  if (window.ZXing) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = ZXING_URL; s.onload = res; s.onerror = () => rej(new Error('読み取り機能を読み込めませんでした'));
    document.head.appendChild(s);
  });
}

const isIsbn = (code) => /^97[89]\d{10}$/.test(code);

export class IsbnScanner {
  constructor(video) { this.video = video; this.stream = null; this.stopped = true; this.zx = null; }

  async start(onIsbn) {
    this.stopped = false;
    let native = null;
    if ('BarcodeDetector' in window) {
      try {
        const formats = await BarcodeDetector.getSupportedFormats();
        if (formats.includes('ean_13')) native = new BarcodeDetector({ formats: ['ean_13'] });
      } catch { native = null; }
    }

    if (native) {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      this.video.srcObject = this.stream;
      await this.video.play();
      const tick = async () => {
        if (this.stopped) return;
        try {
          const codes = await native.detect(this.video);
          const hit = codes.map((c) => c.rawValue).find(isIsbn);
          if (hit) { this.stop(); onIsbn(hit); return; }
        } catch { /* 次のフレームへ */ }
        setTimeout(tick, 200);
      };
      tick();
      return;
    }

    await loadZxing();
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13]);
    this.zx = new ZXing.BrowserMultiFormatReader(hints, 300);
    await this.zx.decodeFromConstraints({ video: { facingMode: 'environment' } }, this.video, (result) => {
      if (this.stopped || !result) return;
      const code = result.getText();
      if (isIsbn(code)) { this.stop(); onIsbn(code); }
    });
  }

  stop() {
    this.stopped = true;
    try { this.zx?.reset(); } catch { /* noop */ }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}
