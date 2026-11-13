# 多読きろく帳（おうち英語の解体新書）

子どもの多読を記録する Web アプリです。読んだ本の英語の語数と日本語の冊数・文字数を、カレンダーに記録します。

- **英語は語数、日本語は冊数と文字数**で分けて集計します。月の合計、累計、連続日数、次の目標までのバーを表示します
- **人気の本 約180冊**が語数つきで入っています（ORT、Elephant & Piggie、Frog and Toad、Magic Tree House、ロアルド・ダールなど）。どの数字も目安で、記録する時に直せます
- そのほかの本は **openBD と Google Books** で検索して、表紙とタイトルを取ってきます
- **バーコード（ISBN）の読み取り**に対応しています（iPhone と Android の両方）
- **子どもを複数登録**できます（兄弟それぞれのタブと「みんな」の合計）
- **再読の記録**もできます（「最近読んだ本」からワンタップで登録、回数も指定可能）
- **SNS シェア**：月のまとめ画像（1080×1350）を作ります。X や LINE への投稿、画像の保存ができます
- **次のおすすめの本**：最近読んだ本のレベルから選び、Amazon と楽天のアフィリエイトリンクを付けます

## データの保存先（サイトのサーバーには保存しません）

| 状態 | 保存先 |
|---|---|
| ログインなし | その端末のブラウザ（localStorage） |
| Google ログイン | 本人の Google ドライブの「アプリ専用領域」（本人にも見えない隠しフォルダ。サイト運営者は読めません） |

ほかに、バックアップ用の書き出しと読み込み（JSON ファイル）もできます。

## 設定（`js/config.js`）

```js
googleClientId: '',      // Google OAuth クライアントID
amazonTag: '',           // Amazon アソシエイトのトラッキングID（例: xxxx-22）
rakutenAffiliateId: '',  // 楽天アフィリエイトID
shareUrl: '...',         // SNS で共有されるリンク（WordPress のページ）
```

`googleClientId` が空のままだと、Google ログインのボタンは表示されません（端末への保存だけで動きます）。

## 公開手順

### 1. ブログのサーバー（ConoHa WING）に置く
1. コントロールパネル →「サイト管理」→「ファイルマネージャー」を開きます。
2. `public_html/ouchieigo-club.com/` の中に `tadoku-app` フォルダを作ります。
3. アプリ一式（index.html・css・js・data・assets・og.png）をそのフォルダにアップロードします。
4. `https://www.ouchieigo-club.com/tadoku-app/` を開いて表示されれば完了です。
   更新するときは、変わったファイルを同じ場所に上書きします。記録は利用者のブラウザに残るので、アドレスを変えなければ消えません。

### 2. Google の設定
1. [Google Cloud Console](https://console.cloud.google.com/) の「認証情報」で、OAuth クライアントIDの「承認済みの JavaScript 生成元」に `https://www.ouchieigo-club.com` を追加します。
2. Books API キーの「ウェブサイトの制限」に `https://www.ouchieigo-club.com/*` を追加します。
3. 「OAuth 同意画面」の公開ステータスを「本番環境に公開」にします（テストのままだと、テストユーザーしかログインできません）。

### 3. WordPress のページに表示する
1. 固定ページ（例：`/tadoku/`）に「カスタムHTML」ブロックを追加し、`wordpress/embed.html` の中身を貼り付けます。
2. 公開前に限定したい場合は、公開状態を「パスワード保護」にします。
3. SNS でシェアされた時の見た目は、SEO プラグインでそのページの OGP 画像に `og.png` を設定します。

## ファイル構成

```
index.html          アプリ本体
css/style.css       デザイン（色は先頭の :root で変更できます）
js/config.js        設定（クライアントID、アフィリエイトID）
js/books-db.js      人気の本のリスト（語数の目安）← 本を追加する時はここ
js/app.js           画面の動き
js/storage.js       端末保存と Google ドライブ同期
js/books.js         本の検索、ISBN の照会、アフィリエイトリンク
js/scanner.js       バーコード読み取り
js/share.js         シェア画像の作成
wordpress/embed.html WordPress に貼るコード
og.png              SNS 用のサムネイル
```
