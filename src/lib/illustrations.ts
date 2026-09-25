import { existsSync } from "node:fs";
import path from "node:path";

// タイトル → 生成イラストのファイル名（scripts/generate-illustrations.mjs と対応）
const STORY_ILLUSTRATION_SLUGS: Record<string, string> = {
  "くまさんと はちみつ": "kuma-hachimitsu",
  "うさぎの おおきな ジャンプ": "usagi-jump",
  "雨の日の 学校": "ame-no-gakkou",
  "海で 見つけた 貝がら": "umi-kaigara",
  "森の音楽会": "mori-ongakukai",
  "宇宙飛行士になった少年": "uchuu-hikoushi",
};

export function getIllustrationSrc(storyTitle: string): string | null {
  const slug = STORY_ILLUSTRATION_SLUGS[storyTitle];
  if (!slug) return null;
  const filePath = path.join(process.cwd(), "public", "illustrations", `${slug}.png`);
  if (!existsSync(filePath)) return null;
  return `/illustrations/${slug}.png`;
}
