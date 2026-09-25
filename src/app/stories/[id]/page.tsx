import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasActiveSubscription } from "@/lib/subscription";
import { getIllustrationSrc } from "@/lib/illustrations";
import { StoryReader } from "@/components/StoryReader";

export default async function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const story = await prisma.story.findUnique({
    where: { id },
    include: { level: true },
  });

  if (!story) notFound();

  if (!story.level.isFree) {
    const user = session?.user?.id
      ? await prisma.user.findUnique({ where: { id: session.user.id } })
      : null;
    if (!hasActiveSubscription(user)) {
      return (
        <div className="rounded-xl border border-orange-300 bg-orange-100 p-6 text-center">
          <p className="text-lg font-semibold text-orange-700">
            このおはなしは有料プランのみ利用できます 🔒
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
  }

  const illustrationSrc = getIllustrationSrc(story.title);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/levels/${story.level.code}`}
          className="text-sm text-orange-600 underline"
        >
          ← {story.level.title} へ戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-orange-600">
          {story.title}
        </h1>
      </div>

      {illustrationSrc && (
        <div className="overflow-hidden rounded-2xl border border-orange-200 bg-[#FFFBF2]">
          <Image
            src={illustrationSrc}
            alt={story.title}
            width={1024}
            height={768}
            className="h-auto w-full"
            priority
          />
        </div>
      )}

      <StoryReader storyId={story.id} body={story.body} audioUrl={story.audioUrl} />
    </div>
  );
}
