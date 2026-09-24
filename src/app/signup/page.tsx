"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "登録に失敗しました。");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("登録は完了しましたが、自動ログインに失敗しました。ログインページからお試しください。");
      return;
    }

    router.push("/levels");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm rounded-xl bg-white p-6 shadow">
      <h1 className="mb-4 text-2xl font-bold text-orange-600">新規登録</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          お名前（にっくねーむ）
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          メールアドレス
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          パスワード（8文字以上）
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? "登録中..." : "登録する"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login" className="text-orange-600 underline">
          ログイン
        </Link>
      </p>
    </div>
  );
}
