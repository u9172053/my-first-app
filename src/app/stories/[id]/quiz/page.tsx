import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { QuizForm } from "@/components/QuizForm";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const story = await prisma.story.findUnique({
    where: { id },
    include: {
      level: true,
      questions: { orderBy: { order: "asc" } },
    },
  });

  if (!story) notFound();

  if (!session?.user?.id) {
    return (
      <div className="rounded-xl border border-orange-300 bg-orange-100 p-6 text-center">
        <p className="font-semibold text-orange-700">
          クイズに挑戦するにはログインが必要です。
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-full bg-orange-500 px-6 py-2 font-semibold text-white hover:bg-orange-600"
        >
          ログインする
        </Link>
      </div>
    );
  }

  const questions = story.questions.map((q) => ({
    id: q.id,
    question: q.question,
    choices: JSON.parse(q.choices) as string[],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/stories/${story.id}`} className="text-sm text-orange-600 underline">
          ← おはなしに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-orange-600">
          {story.title} のクイズ
        </h1>
      </div>

      <QuizForm storyId={story.id} levelCode={story.level.code} questions={questions} />
    </div>
  );
}
