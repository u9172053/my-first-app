import Link from "next/link";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex flex-col items-center gap-8 py-10 text-center">
      <h1 className="text-4xl font-extrabold text-orange-600">
        よみキッズ
      </h1>
      <p className="max-w-xl text-lg text-gray-700">
        レベル別の読みものを「きく（リスニング）」「よむ（音読）」「こたえる（クイズ）」の3ステップで、
        楽しみながら日本語の読む力を伸ばそう！
      </p>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
        <FeatureCard emoji="🎧" title="リスニング" desc="おはなしを声で聞いて、耳から日本語に慣れよう" />
        <FeatureCard emoji="🗣️" title="音読" desc="自分の声を録音して、聞き返しながら練習しよう" />
        <FeatureCard emoji="📝" title="クイズ" desc="読んだ内容をクイズでチェック、理解度がわかる" />
      </div>

      {session ? (
        <Link
          href="/levels"
          className="rounded-full bg-orange-500 px-8 py-3 text-lg font-bold text-white shadow hover:bg-orange-600"
        >
          レベルを えらぶ
        </Link>
      ) : (
        <div className="flex gap-4">
          <Link
            href="/signup"
            className="rounded-full bg-orange-500 px-8 py-3 text-lg font-bold text-white shadow hover:bg-orange-600"
          >
            無料ではじめる
          </Link>
          <Link
            href="/login"
            className="rounded-full border-2 border-orange-500 px-8 py-3 text-lg font-bold text-orange-600 hover:bg-orange-50"
          >
            ログイン
          </Link>
        </div>
      )}
    </div>
  );
}

function FeatureCard({
  emoji,
  title,
  desc,
}: {
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow">
      <div className="text-3xl">{emoji}</div>
      <h3 className="mt-2 font-bold text-orange-600">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{desc}</p>
    </div>
  );
}
