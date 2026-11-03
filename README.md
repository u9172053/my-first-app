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

### 1. GitHub Pages で公開する
1. 無料プランでは **非公開リポジトリから GitHub Pages を公開できません**。リポジトリを Public にしてください。コードに秘密の情報は入っていません（クライアントIDは公開しても問題ない値です）。
2. GitHub のリポジトリで Settings → Pages → Branch: `main` / `(root)` を選んで Save します。
3. 数分後に `https://u9172053.github.io/my-first-app/` で公開されます。

### 2. Google ログインの設定（English Quest のクライアントIDを流用できます）
1. [Google Cloud Console](https://console.cloud.google.com/) で English Quest のプロジェクトを開きます。
2. 「API とサービス」→「ライブラリ」で **Google Drive API** を有効にします。
3. 「認証情報」→ English Quest の OAuth クライアントID（ウェブアプリケーション）を開き、「承認済みの JavaScript 生成元」に次を追加します：
   - `https://u9172053.github.io`
4. 「OAuth 同意画面」→「データアクセス（スコープ）」に `.../auth/drive.appdata` を追加します。
5. 同意画面の公開ステータスが「テスト」のままだと、テストユーザーとして登録した人しかログインできません。「本番環境に公開」にしてください（drive.appdata は審査の軽い「非機密」スコープです）。
6. クライアントID（`xxxx.apps.googleusercontent.com`）を `js/config.js` の `googleClientId` に貼り付けます。

### 3. WordPress に埋め込む
1. 固定ページを新規作成します（例：「多読きろく帳」）。
2. 「カスタムHTML」ブロックに `wordpress/embed.html` の中身を貼り付けます。
3. SNS でシェアされた時の見た目を整えるには、SEO プラグインでそのページの OGP 画像に `og.png` を設定してください。

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
