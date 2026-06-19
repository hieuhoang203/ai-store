"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://ai-store-lnin.onrender.com";

export const AUTH_TOKEN_KEY = "ai-store-admin-token";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setErrorMsg("Link đăng nhập không hợp lệ (thiếu token).");
      setStatus("error");
      return;
    }

    async function exchangeToken() {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/admin/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({})) as { message?: string };
          throw new Error(data.message || `Lỗi ${response.status}`);
        }

        const data = await response.json() as { accessToken?: string };
        if (!data.accessToken) throw new Error("Backend không trả về accessToken.");

        localStorage.setItem(AUTH_TOKEN_KEY, data.accessToken);
        router.replace("/");
      } catch (error) {
        setErrorMsg(error instanceof Error ? error.message : "Đăng nhập thất bại.");
        setStatus("error");
      }
    }

    void exchangeToken();
  }, [searchParams, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {status === "loading" ? (
          <div className="space-y-4">
            {/* Spinner */}
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-emerald-400" />
            <p className="text-sm font-semibold text-zinc-300">
              Đang xác thực đăng nhập...
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-6 shadow-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-400/20 text-2xl">
              ⚠️
            </div>
            <h1 className="text-lg font-black text-white">Đăng nhập thất bại</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{errorMsg}</p>
            <p className="mt-4 text-xs text-zinc-500">
              Vui lòng gõ <code className="text-emerald-300">/admin</code> lại trong
              Telegram để lấy link mới (link chỉ dùng được 1 lần, trong 5 phút).
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
