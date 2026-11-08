// ============================================================
//  設定ファイル  ― ここだけ書き換えればOK
// ============================================================
export const CONFIG = {
  appName: '多読きろく帳',
  siteName: 'おうち英語の解体新書',
  siteUrl: 'https://www.ouchieigo-club.com/kaitai-shinsho/',

  // このアプリを埋め込んだ WordPress ページのURL（SNSシェアのリンク先）
  shareUrl: 'https://www.ouchieigo-club.com/kaitai-shinsho/',

  // Google Cloud で発行した OAuth クライアントID（English Quest で使ったものを流用可）
  // 例: '1234567890-xxxxxxxx.apps.googleusercontent.com'
  // 空欄のままだと Google ログインボタンは非表示（端末保存のみ）
  googleClientId: '949712431544-nfs0vmjg38hnr2qcun17b6t925n5ri67.apps.googleusercontent.com',

  // Google Books API キー（本の検索・表紙用。キーなしだと共有枠が尽きて動かないことがある）
  // Google Cloud →「APIとサービス」→「認証情報」→「APIキーを作成」で発行し、
  // 「ウェブサイト」制限と「Books API」制限をかけておけば公開しても安全です
  googleBooksApiKey: 'AIzaSyDHE8aSxDB8LH90qnJnuRZF3Lf_AUTGwAg',

  // Amazon アソシエイトのトラッキングID（例: 'ouchieigo-22'）
  amazonTag: 'u9172053-22',
  // 楽天アフィリエイトID（例: '1a2b3c4d.5e6f7a8b.1a2b3c4d.5e6f7a8b'）
  rakutenAffiliateId: '16c5e5c6.51eed2fb.16c5e5c7.a39556bb',

  hashtags: ['おうち英語', '多読', 'おうち英語の解体新書'],
};
