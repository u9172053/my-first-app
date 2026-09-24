import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const { storyId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const answers: Array<{ questionId: string; selectedIndex: number }> =
    Array.isArray(body?.answers) ? body.answers : [];

  const questions = await prisma.quizQuestion.findMany({
    where: { storyId },
  });

  if (questions.length === 0) {
    return NextResponse.json({ error: "クイズが見つかりません。" }, { status: 404 });
  }

  const questionMap = new Map(questions.map((q) => [q.id, q]));
  let correctCount = 0;

  const attemptsData = answers
    .filter((a) => questionMap.has(a.questionId))
    .map((a) => {
      const question = questionMap.get(a.questionId)!;
      const isCorrect = question.correctIndex === a.selectedIndex;
      if (isCorrect) correctCount += 1;
      return {
        userId: session.user.id,
        questionId: a.questionId,
        selectedIndex: a.selectedIndex,
        isCorrect,
      };
    });

  await prisma.quizAttempt.createMany({ data: attemptsData });

  await prisma.readingProgress.upsert({
    where: { userId_storyId: { userId: session.user.id, storyId } },
    update: { quizScore: correctCount, quizTotal: questions.length },
    create: {
      userId: session.user.id,
      storyId,
      quizScore: correctCount,
      quizTotal: questions.length,
    },
  });

  const results = questions
    .sort((a, b) => a.order - b.order)
    .map((q) => {
      const answer = answers.find((a) => a.questionId === q.id);
      return {
        questionId: q.id,
        question: q.question,
        choices: JSON.parse(q.choices) as string[],
        correctIndex: q.correctIndex,
        selectedIndex: answer?.selectedIndex ?? null,
      };
    });

  return NextResponse.json({
    score: correctCount,
    total: questions.length,
    results,
  });
}
