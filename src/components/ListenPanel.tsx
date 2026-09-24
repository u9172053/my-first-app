"use client";

import { useRef, useState } from "react";

export function ListenPanel({
  text,
  audioUrl,
  onListened,
}: {
  text: string;
  audioUrl?: string | null;
  onListened?: () => void;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [rate, setRate] = useState(0.9);
  const [supported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasNotifiedRef = useRef(false);

  function notifyListened() {
    if (!hasNotifiedRef.current) {
      hasNotifiedRef.current = true;
      onListened?.();
    }
  }

  function handleSpeak() {
    if (audioUrl) {
      audioRef.current?.play();
      return;
    }

    if (!supported) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = rate;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => {
      setSpeaking(false);
      notifyListened();
    };
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function handleStop() {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <h3 className="mb-2 font-bold text-blue-700">🎧 リスニング</h3>

      {audioUrl ? (
        <audio
          ref={audioRef}
          src={audioUrl}
          controls
          className="w-full"
          onEnded={notifyListened}
        />
      ) : supported ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={speaking ? handleStop : handleSpeak}
            className="rounded-full bg-blue-500 px-5 py-2 font-semibold text-white hover:bg-blue-600"
          >
            {speaking ? "■ とめる" : "▶ きく"}
          </button>
          <label className="flex items-center gap-2 text-xs text-blue-800">
            はやさ
            <input
              type="range"
              min={0.5}
              max={1.3}
              step={0.1}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          </label>
        </div>
      ) : (
        <p className="text-sm text-red-600">
          お使いのブラウザは音声読み上げに対応していません。
        </p>
      )}
    </div>
  );
}
