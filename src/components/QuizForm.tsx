"use client";

import { useState } from "react";
import Link from "next/link";

type Question = {
  id: string;
  question: string;
  choices: string[];
};

type ResultItem = {
  questionId: string;
  question: string;
  choices: string[];
  correctIndex: number;
  selectedIndex: number | null;
};

export function QuizForm({
  storyId,
  levelCode,
  questions,
}: {
  storyId: string;
  levelCode: string;
  questions: Question[];
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total: number;
    results: ResultItem[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quiz/${storyId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.entries(answers).map(([questionId, selectedIndex]) => ({
            questionId,
            selectedIndex,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "送信に失敗しました。ログインしているか確認してください。");
        return;
      }
      const data = await res.json();
      setResult(data);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-purple-100 p-5 text-center">
          <p className="text-2xl font-bold text-purple-700">
            {result.score} / {result.total} 点
          </p>
          <p className="mt-1 text-sm text-purple-600">
            {result.score === result.total
              ? "パーフェクト！すごいね🎉"
              : "よくできました！もう一度読んで復習してみよう"}
          </p>
        </div>

        {result.results.map((r, i) => (
          <div
            key={r.questionId}
            className={`rounded-lg border p-4 ${
              r.selectedIndex === r.correctIndex
                ? "border-green-300 bg-green-50"
                : "border-red-300 bg-red-50"
            }`}
          >
            <p className="font-semibold">
              問{i + 1}. {r.question}
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {r.choices.map((choice, idx) => (
                <li
                  key={idx}
                  className={
                    idx === r.correctIndex
                      ? "font-bold text-green-700"
                      : idx === r.selectedIndex
                        ? "text-red-700 line-through"
                        : "text-gray-600"
                  }
                >
                  {idx === r.correctIndex ? "✅ " : idx === r.selectedIndex ? "❌ " : "　"}
                  {choice}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <Link
          href={`/levels/${levelCode}`}
          className="mt-2 rounded-full bg-orange-500 px-5 py-3 text-center font-semibold text-white hover:bg-orange-600"
        >
          レベル一覧にもどる
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-purple-200 bg-white p-4">
          <p className="font-semibold">
            問{i + 1}. {q.question}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {q.choices.map((choice, idx) => (
              <label
                key={idx}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${
                  answers[q.id] === idx
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === idx}
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                />
                {choice}
              </label>
            ))}
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitting}
        className="rounded-full bg-purple-500 px-5 py-3 font-semibold text-white hover:bg-purple-600 disabled:opacity-40"
      >
        {submitting ? "採点中..." : "こたえあわせ"}
      </button>
    </div>
  );
}
