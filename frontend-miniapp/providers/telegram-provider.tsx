"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type TelegramWebApp = {
  initData?: string;
  colorScheme?: "light" | "dark";
  ready?: () => void;
  expand?: () => void;
  BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void };
  MainButton?: {
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
  };
};

type TelegramContextValue = {
  webApp?: TelegramWebApp;
  initData: string;
  isTelegram: boolean;
};

const TelegramContext = createContext<TelegramContextValue>({
  initData: "",
  isTelegram: false,
});

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [webApp, setWebApp] = useState<TelegramWebApp | undefined>();
  const [fallbackInitData, setFallbackInitData] = useState("");

  useEffect(() => {
    setFallbackInitData(readInitDataFromUrl());

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const app = window.Telegram?.WebApp;

      if (app) {
        app.ready?.();
        app.expand?.();
        setWebApp(app);
      }

      if (app?.initData || attempts >= 40) {
        window.clearInterval(timer);
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, []);

  const value = useMemo(
    () => ({
      webApp,
      initData: webApp?.initData || fallbackInitData,
      isTelegram: Boolean(webApp) || Boolean(fallbackInitData),
    }),
    [fallbackInitData, webApp],
  );

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}

export function useTelegramContext() {
  return useContext(TelegramContext);
}

function readInitDataFromUrl() {
  if (typeof window === "undefined") return "";

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);
  return hashParams.get("tgWebAppData") || searchParams.get("tgWebAppData") || "";
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}
