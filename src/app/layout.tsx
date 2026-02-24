import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "앱 검수 관리",
  description: "개발항목 관리 · 오류 추적 · Google Chat 알림",
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
