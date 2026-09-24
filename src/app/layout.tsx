import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { NavBar } from "@/components/NavBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "よみキッズ | 日本語よみもの学習アプリ",
  description: "レベル別の読みもの・リスニング・音読・クイズで日本語の読む力を伸ばそう",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-orange-50 text-gray-900">
        <Providers>
          <NavBar />
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
