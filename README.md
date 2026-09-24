# よみキッズ

「ラズキッズ」の日本語版をイメージした、レベル別の読みもの学習アプリです。
レベルごとの読みものを「リスニング」「音読」「クイズ」の3ステップで学習できます。

## 機能

- レベル別の読みもの（無料レベル / 有料レベル）
- リスニング：ブラウザの音声合成（Web Speech API）で読み上げ。将来的に本物の音声ファイルへの差し替えにも対応（`Story.audioUrl`）
- 音読：マイクで録音し、その場で聞き返せる（サーバーには保存されません）
- クイズ：ストーリーごとの選択式クイズ、結果をDBに保存
- 会員登録・ログイン（メール + パスワード）
- 月額200円のプレミアムプラン（Stripe Subscription）で全レベル解放

## 技術スタック

- Next.js (App Router) + TypeScript + Tailwind CSS
- Prisma（開発: SQLite / 本番: 他のDBに変更可）
- NextAuth（Auth.js）v5 beta（Credentials認証）
- Stripe（サブスクリプション課金）

## セットアップ

```bash
npm install
cp .env.example .env   # 必要な値を設定
npx prisma migrate dev
npx prisma db seed
npm run dev
```

`http://localhost:3000` で起動します。

### 環境変数

`.env.example` を参照してください。Stripe関連の値（`STRIPE_SECRET_KEY` など）は
実際に課金機能を使う場合のみ必要です。未設定でもアプリ自体は動作し、決済ボタンは
案内メッセージを表示します。

## 今後の拡張候補

- 本物の読み上げ音声ファイルの追加（`Story.audioUrl`）
- 発音判定（音声認識）による音読フィードバック
- レベル・ストーリーの追加（管理画面やCMS連携）
