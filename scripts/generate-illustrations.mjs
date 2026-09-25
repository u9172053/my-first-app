// 絵本イラストを生成し、public/illustrations/ に保存する。
// 使い方: node scripts/generate-illustrations.mjs
//
// Pollinations.ai（無料・APIキー不要の画像生成API）を使用。
// このクラウド環境からは image.pollinations.ai への通信を許可する必要があります
// （環境メニュー → Edit → ネットワークアクセスで許可ドメインに追加）。

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "illustrations");

// 全イラストで統一するアートスタイル（絵本として世界観をそろえるため）
const STYLE_PREFIX =
  "flat vector children's picture-book illustration, soft rounded shapes, " +
  "warm pastel color palette, sky blue leaf green coral sunny yellow, " +
  "simple friendly character faces, gentle sunlight, no text no watermark, " +
  "clean minimal background, wholesome and cheerful mood, ";

const stories = [
  {
    slug: "kuma-hachimitsu",
    title: "くまさんと はちみつ",
    prompt:
      STYLE_PREFIX +
      "a chubby brown bear cub gently reaching toward a small beehive hanging from a tree branch in a sunny forest, tasting honey with a happy expression, green trees and a few flowers around",
    seed: 1,
  },
  {
    slug: "usagi-jump",
    title: "うさぎの おおきな ジャンプ",
    prompt:
      STYLE_PREFIX +
      "a white rabbit joyfully jumping very high above a grassy field, while a small brown squirrel claps its paws nearby, sunny sky, a few clouds",
    seed: 2,
  },
  {
    slug: "ame-no-gakkou",
    title: "雨の日の 学校",
    prompt:
      STYLE_PREFIX +
      "a cheerful child holding a red umbrella, walking on a rainy day toward a cute two-story school building, puddles on the ground, soft grey rain clouds",
    seed: 3,
  },
  {
    slug: "umi-kaigara",
    title: "海で 見つけた 貝がら",
    prompt:
      STYLE_PREFIX +
      "a little girl on a sandy beach happily holding up a pink star-shaped seashell she just found, calm blue ocean waves and a bright sun in the background",
    seed: 4,
  },
  {
    slug: "mori-ongakukai",
    title: "森の音楽会",
    prompt:
      STYLE_PREFIX +
      "a small forest concert at autumn, a squirrel playing a tiny violin, a bear playing a drum, and a rabbit singing, colorful autumn leaves falling, other forest animals listening happily",
    seed: 5,
  },
  {
    slug: "uchuu-hikoushi",
    title: "宇宙飛行士になった少年",
    prompt:
      STYLE_PREFIX +
      "a young astronaut child in a cute rounded spacesuit floating in space, looking back at a beautiful blue Earth, stars twinkling around, warm and dreamy mood",
    seed: 6,
  },
];

async function generateOne(story) {
  const encoded = encodeURIComponent(story.prompt);
  const url =
    `https://image.pollinations.ai/prompt/${encoded}` +
    `?width=1024&height=768&nologo=true&seed=${story.seed}`;

  const res = await fetch(url);
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const outPath = path.join(OUT_DIR, `${story.slug}.png`);
  await writeFile(outPath, buffer);
  return outPath;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const story of stories) {
    process.stdout.write(`生成中: ${story.title} ... `);
    try {
      const outPath = await generateOne(story);
      console.log(`OK → ${path.relative(process.cwd(), outPath)}`);
    } catch (err) {
      console.log("失敗");
      console.error(`  ${story.title}: ${err.message}`);
    }
  }

  console.log("すべてのイラスト生成処理が完了しました。");
}

main();
