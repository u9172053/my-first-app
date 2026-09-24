"use client";

import { useRef, useState } from "react";

export function RecordPanel({ onRecorded }: { onRecorded?: () => void }) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        onRecorded?.();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("マイクを使用できませんでした。ブラウザのマイク許可を確認してください。");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
      <h3 className="mb-2 font-bold text-green-700">🗣️ 音読（じぶんの声を きいてみよう）</h3>
      <p className="mb-3 text-xs text-gray-600">
        おはなしを声に出して読んで、録音してみよう。録音した音声はこの端末の中だけで再生され、サーバーには保存されません。
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {!recording ? (
          <button
            onClick={startRecording}
            className="rounded-full bg-green-500 px-5 py-2 font-semibold text-white hover:bg-green-600"
          >
            ● ろくおん スタート
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="animate-pulse rounded-full bg-red-500 px-5 py-2 font-semibold text-white hover:bg-red-600"
          >
            ■ ろくおん ストップ
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {audioUrl && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-gray-600">きき返してみよう：</p>
          <audio src={audioUrl} controls className="w-full" />
        </div>
      )}
    </div>
  );
}
