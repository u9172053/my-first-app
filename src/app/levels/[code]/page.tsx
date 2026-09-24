import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasActiveSubscription } from "@/lib/subscription";

export default async function LevelDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await auth();

  const level = await prisma.level.findUnique({
    where: { code },
    include: { stories: { orderBy: { order: "asc" } } },
  });

  if (!level) notFound();

  const user = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id } })
    : null;
  const subscribed = hasActiveSubscription(user);

  if (!level.isFree && !subscribed) {
    return (
      <div className="rounded-xl border border-orange-300 bg-orange-100 p-6 text-center">
        <p className="text-lg font-semibold text-orange-700">
          このレベルは有料プランのみ利用できます 🔒
        </p>
        <Link
          href="/account"
          className="mt-4 inline-block rounded-full bg-orange-500 px-6 py-2 font-semibold text-white hover:bg-orange-600"
        >
          プランを見る
        </Link>
      </div>
    );
  }

  const progress = session?.user?.id
    ? await prisma.readingProgress.findMany({
        where: {
          userId: session.user.id,
          storyId: { in: level.stories.map((s) => s.id) },
        },
      })
    : [];

  const progressByStory = new Map(progress.map((p) => [p.storyId, p]));

  return (
    <div>
      <Link href="/levels" className="text-sm text-orange-600 underline">
        ← レベル一覧へ戻る
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-bold text-orange-600">
        {level.title}
      </h1>

      <div className="flex flex-col gap-3">
        {level.stories.map((story) => {
          const p = progressByStory.get(story.id);
          return (
            <Link
              key={story.id}
              href={`/stories/${story.id}`}
              className="flex items-center gap-4 rounded-xl border border-orange-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              {story.imageUrl && (
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-orange-50 border border-orange-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={story.imageUrl}
                    alt={story.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <h2 className="font-bold text-gray-800">{story.title}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  {p?.listened && "🎧きいた "}
                  {p?.readAloudDone && "🗣️よんだ "}
                  {p?.quizScore != null && `📝 ${p.quizScore}/${p.quizTotal}点`}
                  {!p && "まだ挑戦していません"}
                </p>
              </div>
              <span className="text-orange-400 font-bold">→</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
