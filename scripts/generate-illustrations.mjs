// Nano Banana (Gemini API) で絵本イラストを生成し、public/illustrations/ に保存する。
// 使い方: GEMINI_API_KEY=xxxx node scripts/generate-illustrations.mjs
//
// 環境変数 GEMINI_API_KEY が必要です（Google AI Studio で発行、
// 紐づいたGoogle Cloudプロジェクトで課金が有効になっていること）。

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error(
    "GEMINI_API_KEY が設定されていません。環境変数にGoogle AI StudioのAPIキーを設定してから実行してください。"
  );
  process.exit(1);
}

const MODEL = "gemini-3.1-flash-image-preview";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const OUT_DIR = path.join(process.cwd(), "public", "illustrations");

// 全イラストで統一するアートスタイル（絵本として世界観をそろえるため）
const STYLE_PREFIX =
  "Flat vector children's picture-book illustration, soft rounded shapes, " +
  "warm pastel color palette (sky blue, leaf green, coral, sunny yellow), " +
  "simple friendly character faces, gentle sunlight, no text or watermark, " +
  "clean minimal background, wholesome and cheerful mood. Scene: ";

const stories = [
  {
    slug: "kuma-hachimitsu",
    title: "くまさんと はちみつ",
    prompt:
      STYLE_PREFIX +
      "a chubby brown bear cub gently reaching toward a small beehive hanging from a tree branch in a sunny forest, tasting honey with a happy expression, green trees and a few flowers around.",
  },
  {
    slug: "usagi-jump",
    title: "うさぎの おおきな ジャンプ",
    prompt:
      STYLE_PREFIX +
      "a white rabbit joyfully jumping very high above a grassy field, while a small brown squirrel claps its paws nearby, sunny sky, a few clouds.",
  },
  {
    slug: "ame-no-gakkou",
    title: "雨の日の 学校",
    prompt:
      STYLE_PREFIX +
      "a cheerful child holding a red umbrella, walking on a rainy day toward a cute two-story school building, puddles on the ground, soft grey rain clouds.",
  },
  {
    slug: "umi-kaigara",
    title: "海で 見つけた 貝がら",
    prompt:
      STYLE_PREFIX +
      "a little girl on a sandy beach happily holding up a pink star-shaped seashell she just found, calm blue ocean waves and a bright sun in the background.",
  },
  {
    slug: "mori-ongakukai",
    title: "森の音楽会",
    prompt:
      STYLE_PREFIX +
      "a small forest concert at autumn: a squirrel playing a tiny violin, a bear playing a drum, and a rabbit singing, colorful autumn leaves falling, other forest animals listening happily.",
  },
  {
    slug: "uchuu-hikoushi",
    title: "宇宙飛行士になった少年",
    prompt:
      STYLE_PREFIX +
      "a young astronaut child in a cute rounded spacesuit floating in space, looking back at a beautiful blue Earth, stars twinkling around, warm and dreamy mood.",
  },
];

async function generateOne(story) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: story.prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "4:3", imageSize: "1K" },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart) {
    throw new Error("レスポンスに画像データが含まれていません: " + JSON.stringify(data).slice(0, 500));
  }

  const buffer = Buffer.from(imagePart.inlineData.data, "base64");
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
    // レート制限対策で少し間隔を空ける
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log("すべてのイラスト生成処理が完了しました。");
}

main();
