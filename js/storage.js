// ============================================================
//  データ保存：端末(localStorage) ＋ 本人の Google ドライブ（アプリ専用領域）
//  サイト側のサーバーには一切データを送りません。
// ============================================================
import { CONFIG } from './config.js';

const KEY = 'tadoku-kiroku-v1';
const DRIVE_FILE = 'tadoku-kiroku.json';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function emptyState() {
  const now = Date.now();
  return {
    version: 1,
    children: [{ id: 'c' + uid(), name: 'わが子', emoji: '👶', updatedAt: now }],
    logs: [],
    settings: { activeChild: 'all', shareShowName: false },
    updatedAt: now,
  };
}

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }

export function loadState() {
  const raw = safeGet(KEY);
  if (!raw) return emptyState();
  try {
    const s = JSON.parse(raw);
    if (!s.children || !s.logs) return emptyState();
    s.settings = { activeChild: 'all', shareShowName: false, ...(s.settings || {}) };
    // 最初から入っている「わが子」のマークを、くま🐻から赤ちゃん👶に（名前もマークも変えていない人だけ）
    for (const c of s.children) if (c.name === 'わが子' && c.emoji === '🐻') c.emoji = '👶';
    return s;
  } catch { return emptyState(); }
}

export function saveLocal(state) {
  state.updatedAt = Date.now();
  return safeSet(KEY, JSON.stringify(state));
}

// 2つの状態をマージ（ID単位で updatedAt が新しい方を採用。削除は deleted フラグで伝搬）
export function mergeState(local, remote) {
  if (!remote) return local;
  const mergeList = (a = [], b = []) => {
    const map = new Map();
    for (const x of [...a, ...b]) {
      const cur = map.get(x.id);
      if (!cur || (x.updatedAt || 0) > (cur.updatedAt || 0)) map.set(x.id, x);
    }
    return [...map.values()];
  };
  return {
    ...local,
    children: mergeList(local.children, remote.children),
    logs: mergeList(local.logs, remote.logs),
    settings: local.settings,
  };
}

// ---------------- Google ドライブ同期 ----------------
export class DriveSync {
  constructor(onStatus) {
    this.onStatus = onStatus;
    this.token = null;
    this.expiresAt = 0;
    this.fileId = null;
    this.tokenClient = null;
    this.pending = null;
    this.timer = null;
  }
  get enabled() { return !!CONFIG.googleClientId; }
  get linked() { return safeGet('tadoku-g-linked') === '1'; }
  set linked(v) { safeSet('tadoku-g-linked', v ? '1' : '0'); }
  get hasToken() { return this.token && Date.now() < this.expiresAt - 60000; }

  loadGis() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = res; s.onerror = () => rej(new Error('Googleのスクリプトを読み込めませんでした'));
      document.head.appendChild(s);
    });
  }

  // ユーザー操作（クリック）の中で呼ぶこと（ポップアップのため）
  async signIn(getState, setState) {
    await this.loadGis();
    return new Promise((resolve) => {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.googleClientId,
        scope: SCOPE,
        callback: async (resp) => {
          if (resp.error) { this.onStatus('error', 'ログインできませんでした'); return resolve(false); }
          this.token = resp.access_token;
          this.expiresAt = Date.now() + (resp.expires_in || 3600) * 1000;
          this.linked = true;
          await this.sync(getState, setState);
          resolve(true);
        },
        error_callback: () => { this.onStatus('error', 'ログインがキャンセルされました'); resolve(false); },
      });
      this.tokenClient.requestAccessToken({ prompt: this.linked ? '' : 'consent' });
    });
  }

  signOut() {
    if (this.token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(this.token, () => {});
    this.token = null; this.fileId = null; this.linked = false;
    this.onStatus('off');
  }

  async api(url, opts = {}) {
    const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + this.token, ...(opts.headers || {}) } });
    if (r.status === 401) { this.token = null; throw new Error('auth'); }
    if (!r.ok) throw new Error('Drive ' + r.status);
    return r;
  }

  async findFile() {
    if (this.fileId) return this.fileId;
    const q = encodeURIComponent(`name='${DRIVE_FILE}'`);
    const r = await this.api(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`);
    const j = await r.json();
    this.fileId = j.files?.[0]?.id || null;
    return this.fileId;
  }

  async sync(getState, setState) {
    if (!this.hasToken) { this.onStatus(this.linked ? 'stale' : 'off'); return false; }
    this.onStatus('syncing');
    try {
      const id = await this.findFile();
      let merged = getState();
      if (id) {
        const r = await this.api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
        const remote = await r.json().catch(() => null);
        merged = mergeState(merged, remote);
        setState(merged);
      }
      const body = JSON.stringify(merged);
      if (id) {
        await this.api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body,
        });
      } else {
        const boundary = 'tdk' + uid();
        const meta = JSON.stringify({ name: DRIVE_FILE, parents: ['appDataFolder'] });
        const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
        const r = await this.api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
          method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart,
        });
        this.fileId = (await r.json()).id;
      }
      this.onStatus('ok');
      return true;
    } catch (e) {
      this.onStatus(e.message === 'auth' ? 'stale' : 'error', e.message === 'auth' ? '' : '同期に失敗しました');
      return false;
    }
  }

  // データ変更のたびに呼ぶ（3秒まとめて送信）
  schedule(getState, setState) {
    if (!this.linked) return;
    if (!this.hasToken) { this.onStatus('stale'); return; }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.sync(getState, setState), 3000);
  }
}
