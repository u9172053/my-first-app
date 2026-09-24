"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ListenPanel } from "./ListenPanel";
import { RecordPanel } from "./RecordPanel";

export function StoryInteractions({
  storyId,
  text,
  audioUrl,
}: {
  storyId: string;
  text: string;
  audioUrl?: string | null;
}) {
  const { status } = useSession();
  const [listened, setListened] = useState(false);
  const [readAloudDone, setReadAloudDone] = useState(false);

  async function saveProgress(field: "listened" | "readAloudDone") {
    if (status !== "authenticated") return;
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, field }),
      });
    } catch {
      // ネットワークエラーは静かに無視（進捗記録は補助機能のため）
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ListenPanel
        text={text}
        audioUrl={audioUrl}
        onListened={() => {
          setListened(true);
          void saveProgress("listened");
        }}
      />
      <RecordPanel
        onRecorded={() => {
          setReadAloudDone(true);
          void saveProgress("readAloudDone");
        }}
      />

      <div className="flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50 p-4">
        <div className="text-sm text-purple-700">
          {listened && "🎧 "}
          {readAloudDone && "🗣️ "}
          じゅんびができたら、クイズに ちょうせんしよう！
        </div>
        <Link
          href={`/stories/${storyId}/quiz`}
          className="rounded-full bg-purple-500 px-5 py-2 font-semibold text-white hover:bg-purple-600"
        >
          📝 クイズへ
        </Link>
      </div>
    </div>
  );
}
