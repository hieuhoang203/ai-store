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

  useEffect(() => {
    const app = window.Telegram?.WebApp;
    app?.ready?.();
    app?.expand?.();
    setWebApp(app);
  }, []);

  const value = useMemo(
    () => ({
      webApp,
      initData: webApp?.initData || "",
      isTelegram: Boolean(webApp),
    }),
    [webApp],
  );

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}

export function useTelegramContext() {
  return useContext(TelegramContext);
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}
