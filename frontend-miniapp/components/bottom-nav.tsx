import { Grid2X2, Home, Package, ShoppingCart, User } from "lucide-react";
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
  return (
    <nav className="relative z-20 grid shrink-0 grid-cols-5 border-t border-white/10 bg-[#050805]/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-bold transition ${
              active ? "bg-emerald-300 text-black shadow-[0_0_22px_rgba(30,215,96,0.2)]" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-100"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{tab.label}</span>
            {tab.key === "cart" && cartCount > 0 ? (
              <span className="absolute right-2 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-black">
                {cartCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
