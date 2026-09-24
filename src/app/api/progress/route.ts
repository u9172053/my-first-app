import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const storyId = typeof body?.storyId === "string" ? body.storyId : null;
  const field = body?.field;

  if (!storyId || (field !== "listened" && field !== "readAloudDone")) {
    return NextResponse.json({ error: "不正なリクエストです。" }, { status: 400 });
  }

  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story) {
    return NextResponse.json({ error: "ストーリーが見つかりません。" }, { status: 404 });
  }

  const progress = await prisma.readingProgress.upsert({
    where: { userId_storyId: { userId: session.user.id, storyId } },
    update: { [field]: true },
    create: {
      userId: session.user.id,
      storyId,
      listened: field === "listened",
      readAloudDone: field === "readAloudDone",
    },
  });

  return NextResponse.json(progress);
}
