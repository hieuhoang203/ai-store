import { Grid2X2, Home, Package, ShoppingCart, User } from "lucide-react";
import { useRef } from "react";
import type { MouseEvent, PointerEvent, TouchEvent } from "react";
import type { TabItem, TabKey } from "./mini-app-types";

export const tabs: TabItem[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "categories", label: "Loại", icon: Grid2X2 },
  { key: "cart", label: "Giỏ", icon: ShoppingCart },
  { key: "orders", label: "Đơn", icon: Package },
  { key: "profile", label: "Tôi", icon: User },
];

export function BottomNav({
  activeTab,
  cartCount,
  onSelect,
}: {
  activeTab: TabKey;
  cartCount: number;
  onSelect: (tab: TabKey) => void;
}) {
  const lastActivation = useRef({ tab: "", time: 0, source: "" });

  function tabFromEvent(event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement> | TouchEvent<HTMLElement>) {
    const target = event.target instanceof Element ? event.target : null;
    const tab = target?.closest<HTMLElement>("[data-tab]")?.dataset.tab;
    return tabs.some((item) => item.key === tab) ? (tab as TabKey) : undefined;
  }

  function handlePressStart(event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement> | TouchEvent<HTMLElement>) {
    const tab = tabFromEvent(event);
    if (!tab) return;
    event.preventDefault();
    event.stopPropagation();
    activateTab(event, "pressstart");
  }

  function activateTab(
    event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement> | TouchEvent<HTMLElement>,
    source: string,
  ) {
    const tab = tabFromEvent(event);
    if (!tab) return;
    event.preventDefault();
    event.stopPropagation();

    const now = Date.now();
    const recent = now - lastActivation.current.time < 350;
    if (recent && lastActivation.current.tab === tab) return;

    lastActivation.current = { tab, time: now, source };
    onSelect(tab);
  }

  return (
    <nav
      onClickCapture={(event) => activateTab(event, "click")}
      onMouseDownCapture={handlePressStart}
      onPointerDownCapture={handlePressStart}
      onPointerUpCapture={(event) => activateTab(event, "pointerup")}
      onTouchStartCapture={handlePressStart}
      onTouchEndCapture={(event) => activateTab(event, "touchend")}
      className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-[2147483647] mx-auto grid h-[72px] w-full max-w-md shrink-0 touch-manipulation grid-cols-5 border-t border-emerald-300/20 bg-[#050805] px-2 py-2 shadow-[0_-12px_30px_rgba(0,0,0,0.55)] backdrop-blur-xl"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            data-tab={tab.key}
            className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-bold transition ${
              active ? "bg-emerald-300 text-black shadow-[0_0_22px_rgba(30,215,96,0.2)]" : "text-zinc-200 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{tab.label}</span>
            {tab.key === "cart" && cartCount > 0 ? (
              <span className="absolute right-2 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-black">
                {cartCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
