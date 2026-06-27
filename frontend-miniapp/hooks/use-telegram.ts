"use client";

import { useEffect } from "react";
import { useTelegramContext } from "@/providers/telegram-provider";

export function useTelegramUser() {
  const { initData } = useTelegramContext();
  return { initData };
}

export function useTelegramTheme() {
  const { webApp } = useTelegramContext();
  return { colorScheme: webApp?.colorScheme || "light" };
}

export function useTelegramViewport() {
  const { webApp } = useTelegramContext();
  useEffect(() => {
    webApp?.expand?.();
  }, [webApp]);
}

export function useTelegramExternalLink() {
  const { webApp } = useTelegramContext();

  return (url: string) => {
    if (webApp?.openLink) {
      webApp.openLink(url, { try_instant_view: false });
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };
}

export function useTelegramBackButton(onClick: () => void, visible: boolean) {
  const { webApp } = useTelegramContext();
  useEffect(() => {
    if (!webApp?.BackButton) return;
    if (visible) webApp.BackButton.show();
    else webApp.BackButton.hide();
    webApp.BackButton.onClick(onClick);
  }, [onClick, visible, webApp]);
}

export function useTelegramMainButton(text: string, onClick: () => void, visible: boolean) {
  const { webApp } = useTelegramContext();
  useEffect(() => {
    if (!webApp?.MainButton) return;
    webApp.MainButton.setText(text);
    if (visible) webApp.MainButton.show();
    else webApp.MainButton.hide();
    webApp.MainButton.onClick(onClick);
  }, [onClick, text, visible, webApp]);
}
