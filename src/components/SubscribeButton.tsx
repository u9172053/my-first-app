"use client";

import { useState } from "react";

export function SubscribeButton({ mode }: { mode: "subscribe" | "manage" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === "subscribe" ? "/api/checkout" : "/api/billing-portal";
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "処理に失敗しました。");
        return;
      }
      window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-full bg-orange-500 px-5 py-2 font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
      >
        {loading
          ? "処理中..."
          : mode === "subscribe"
            ? "月額200円プランに登録する"
            : "プランを管理する"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
