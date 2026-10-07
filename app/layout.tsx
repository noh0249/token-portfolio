import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coinfolio | 나의 코인 포트폴리오",
  description: "한눈에 보는 코인 포트폴리오. 거래소와 지갑 연결, USDT 평가액, 자산 비중과 일별 수익률 기록.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
