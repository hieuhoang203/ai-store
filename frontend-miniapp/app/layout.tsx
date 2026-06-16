import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/providers/app-providers";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "AI Store Mini App",
  description: "Telegram Mini App for AI Store",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${roboto.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#050805] text-zinc-100">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
