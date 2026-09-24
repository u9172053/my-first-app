"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export function NavBar() {
  const { data: session, status } = useSession();

  return (
    <header className="bg-orange-500 text-white shadow-sm">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold">
          📚 よみキッズ
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/levels" className="hover:underline">
            レベル一覧
          </Link>
          {status === "authenticated" ? (
            <>
              <span className="hidden sm:inline">
                {session.user?.name || session.user?.email} さん
              </span>
              <Link href="/account" className="hover:underline">
                アカウント
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded bg-orange-600 px-3 py-1 hover:bg-orange-700"
              >
                ログアウト
              </button>
            </>
          ) : status === "loading" ? null : (
            <>
              <Link href="/login" className="hover:underline">
                ログイン
              </Link>
              <Link
                href="/signup"
                className="rounded bg-white px-3 py-1 font-semibold text-orange-600 hover:bg-orange-50"
              >
                新規登録
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
