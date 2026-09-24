import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasActiveSubscription } from "@/lib/subscription";

export default async function LevelsPage() {
  const session = await auth();

  const levels = await prisma.level.findMany({
    orderBy: { order: "asc" },
    include: { stories: { select: { id: true } } },
  });

  const user = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id } })
    : null;

  const subscribed = hasActiveSubscription(user);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-orange-600">レベル一覧</h1>
      <p className="mb-6 text-sm text-gray-600">
        やさしいレベルから じゅんばんに ちょうせんしよう！
      </p>

      {!subscribed && (
        <div className="mb-6 rounded-lg border border-orange-300 bg-orange-100 p-4 text-sm">
          無料プランでは一部のレベルのみ利用できます。すべてのレベルを解放するには
          <Link href="/account" className="mx-1 font-semibold text-orange-700 underline">
            月額プラン（200円）
          </Link>
          にご登録ください。
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {levels.map((level) => {
          const locked = !level.isFree && !subscribed;
          const content = (
            <div
              className={`rounded-xl border p-5 shadow-sm transition ${
                locked
                  ? "border-gray-200 bg-gray-100 opacity-70"
                  : "border-orange-200 bg-white hover:shadow-md"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-orange-600">{level.title}</h2>
                {locked && <span className="text-lg">🔒</span>}
              </div>
              <p className="mt-1 text-sm text-gray-600">
                おはなし {level.stories.length}本
                {level.isFree ? "（無料）" : "（有料プラン）"}
              </p>
            </div>
          );

          return locked ? (
            <div key={level.id}>{content}</div>
          ) : (
            <Link key={level.id} href={`/levels/${level.code}`}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
