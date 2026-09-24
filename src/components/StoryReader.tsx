"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { RecordPanel } from "./RecordPanel";

type Token = { text: string; start: number; end: number };

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

function renderLine(line: string, tokens: Token[], activeToken: Token | null) {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  tokens.forEach((token, i) => {
    if (token.start > cursor) {
      nodes.push(line.slice(cursor, token.start));
    }
    nodes.push(
      <span
        key={i}
        className={
          token === activeToken
            ? "rounded bg-orange-500 px-0.5 text-white"
            : "rounded px-0.5"
        }
      >
        {token.text}
      </span>
    );
    cursor = token.end;
  });
  if (cursor < line.length) nodes.push(line.slice(cursor));
  return nodes;
}

export function StoryReader({
  storyId,
  body,
  imageUrl,
  audioUrl,
}: {
  storyId: string;
  body: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
}) {
  const { status } = useSession();
  const lines = useMemo(() => body.split("\n"), [body]);
  const lineTokens = useMemo(() => lines.map(tokenize), [lines]);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [activeCharIndex, setActiveCharIndex] = useState<number | null>(null);
  const [rate, setRate] = useState(0.95);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [status_, setStatusText] = useState("");
  const [readAloudDone, setReadAloudDone] = useState(false);
  const [listened, setListened] = useState(false);

  const playTokenRef = useRef(0);
  const hasNotifiedListenedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const supportsSpeech =
    typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supportsSpeech) return;

    function refreshVoices() {
      const all = window.speechSynthesis.getVoices();
      const japanese = all.filter((v) => v.lang?.toLowerCase().startsWith("ja"));
      const list = (japanese.length ? japanese : all)
        .slice()
        .sort((a, b) => {
          if (a.localService !== b.localService) return a.localService ? 1 : -1;
          return a.name.localeCompare(b.name);
        });
      setVoices(list);
      setVoiceURI((prev) => {
        if (prev && list.some((v) => v.voiceURI === prev)) return prev;
        try {
          const saved = localStorage.getItem("yomikids_voice_uri");
          if (saved && list.some((v) => v.voiceURI === saved)) return saved;
        } catch {
          // ignore
        }
        return list[0]?.voiceURI ?? "";
      });
    }

    refreshVoices();
    window.speechSynthesis.onvoiceschanged = refreshVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      playTokenRef.current++;
      if (supportsSpeech) window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProgress(field: "listened" | "readAloudDone") {
    if (status !== "authenticated") return;
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, field }),
      });
    } catch {
      // 進捗記録は補助機能のため、失敗しても静かに無視する
    }
  }

  function stopSpeaking() {
    playTokenRef.current++;
    if (supportsSpeech) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setActiveLine(null);
    setActiveCharIndex(null);
  }

  function speakStory() {
    if (audioUrl) {
      audioRef.current?.play();
      return;
    }
    if (!supportsSpeech) {
      setStatusText("お使いのブラウザは読み上げに対応していません。");
      return;
    }

    playTokenRef.current++;
    const mySession = playTokenRef.current;
    const voice = voices.find((v) => v.voiceURI === voiceURI) ?? null;

    setIsSpeaking(true);
    setStatusText("よみあげちゅう…");

    function speakLine(i: number) {
      if (mySession !== playTokenRef.current) return;
      if (i >= lines.length) {
        setActiveLine(null);
        setActiveCharIndex(null);
        setIsSpeaking(false);
        setStatusText("よみおわりました。");
        if (!hasNotifiedListenedRef.current) {
          hasNotifiedListenedRef.current = true;
          setListened(true);
          void saveProgress("listened");
        }
        return;
      }

      const utter = new SpeechSynthesisUtterance(lines[i]);
      utter.lang = "ja-JP";
      if (voice) utter.voice = voice;
      utter.rate = rate;

      utter.onstart = () => {
        if (mySession !== playTokenRef.current) return;
        setActiveLine(i);
        setActiveCharIndex(0);
      };
      utter.onboundary = (e) => {
        if (mySession !== playTokenRef.current) return;
        if (typeof e.charIndex === "number") setActiveCharIndex(e.charIndex);
      };
      utter.onend = () => {
        if (mySession !== playTokenRef.current) return;
        speakLine(i + 1);
      };
      utter.onerror = () => {
        if (mySession !== playTokenRef.current) return;
        setIsSpeaking(false);
        setActiveLine(null);
        setActiveCharIndex(null);
        setStatusText("読み上げでエラーが発生しました。");
      };

      window.speechSynthesis.speak(utter);
    }

    speakLine(0);
  }

  function handleVoiceChange(uri: string) {
    setVoiceURI(uri);
    try {
      localStorage.setItem("yomikids_voice_uri", uri);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {imageUrl && (
        <div className="overflow-hidden rounded-2xl border border-orange-200 bg-orange-50 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="おはなしのイラスト"
            className="h-auto max-h-[380px] w-full object-cover"
          />
        </div>
      )}

      <article className="rounded-xl border border-orange-200 bg-white p-6 text-lg leading-loose">
        {lines.map((line, i) => {
          const tokens = lineTokens[i];
          const activeToken =
            activeLine === i && activeCharIndex != null
              ? [...tokens].reverse().find((t) => t.start <= activeCharIndex) ?? null
              : null;
          return (
            <p
              key={i}
              className={`m-0 rounded px-1 ${activeLine === i ? "bg-yellow-50" : ""}`}
            >
              {renderLine(line, tokens, activeToken)}
            </p>
          );
        })}
      </article>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <h3 className="mb-2 font-bold text-blue-700">🎧 リスニング</h3>

        {audioUrl ? (
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            className="w-full"
            onEnded={() => {
              if (!hasNotifiedListenedRef.current) {
                hasNotifiedListenedRef.current = true;
                setListened(true);
                void saveProgress("listened");
              }
            }}
          />
        ) : (
          <>
            <div className="mb-2 flex flex-col gap-1 text-xs text-blue-800">
              こえの しゅるい
              <select
                value={voiceURI}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="rounded border border-blue-200 bg-white px-2 py-1 text-sm text-gray-800"
                disabled={voices.length === 0}
              >
                {voices.length === 0 ? (
                  <option>この端末の既定の声</option>
                ) : (
                  voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name}
                      {!v.localService ? " ・ ネットワーク音声" : ""}（{v.lang}）
                    </option>
                  ))
                )}
              </select>
            </div>
            <p className="mb-2 text-xs text-blue-700">
              ロボットっぽく聞こえる場合は、他の声を選んでみてください。ネットワーク音声のほうが自然に聞こえやすいです。
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={isSpeaking ? stopSpeaking : speakStory}
                className="rounded-full bg-blue-500 px-5 py-2 font-semibold text-white hover:bg-blue-600"
              >
                {isSpeaking ? "■ とめる" : "▶ きく"}
              </button>
              <label className="flex items-center gap-2 text-xs text-blue-800">
                はやさ
                <input
                  type="range"
                  min={0.6}
                  max={1.3}
                  step={0.1}
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                />
              </label>
            </div>
            <p className="mt-2 min-h-[1.2em] text-xs text-blue-700">{status_}</p>
          </>
        )}
      </div>

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
