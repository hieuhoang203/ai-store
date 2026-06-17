import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "AI Store Admin",
  description: "Administration console for AI Store and Telegram commerce",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${roboto.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-[#050805] text-zinc-100" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
