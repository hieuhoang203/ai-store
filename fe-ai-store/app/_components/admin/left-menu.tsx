import { Database, LayoutDashboard } from "lucide-react";
import type { EntityConfig } from "@/app/_lib/admin-types";
import { DASHBOARD_SCREEN_KEY } from "@/app/_lib/admin-screens";

type LeftMenuProps = {
  entities: EntityConfig[];
  activeKey: string;
  onSelect: (key: string) => void;
};

export function LeftMenu({ entities, activeKey, onSelect }: LeftMenuProps) {
  return (
    <aside className="border-b border-white/10 bg-black/55 px-4 py-5 backdrop-blur lg:border-b-0 lg:border-r">
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400 text-black">
          <Database className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-300">AI Store</p>
          <h1 className="text-xl font-black tracking-wide text-white">Admin Console</h1>
        </div>
      </div>

      <nav className="grid gap-1">
        <button
          onClick={() => onSelect(DASHBOARD_SCREEN_KEY)}
          className={`flex h-10 items-center gap-2 rounded-lg px-3 text-left text-sm font-medium transition ${
            activeKey === DASHBOARD_SCREEN_KEY
              ? "bg-emerald-400 text-black shadow-[0_0_24px_rgba(30,215,96,0.22)]"
              : "text-zinc-300 hover:bg-white/8 hover:text-white"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Dashboard</span>
        </button>

        <div className="my-2 h-px bg-white/10" />

        {entities.map((entity) => {
          const isActive = activeKey === entity.key;

          return (
            <button
              key={entity.key}
              onClick={() => onSelect(entity.key)}
              className={`flex h-10 items-center justify-between gap-3 rounded-lg px-3 text-left text-sm font-medium transition ${
                isActive
                  ? "bg-emerald-400 text-black shadow-[0_0_24px_rgba(30,215,96,0.22)]"
                  : "text-zinc-300 hover:bg-white/8 hover:text-white"
              }`}
            >
              <span className="min-w-0 truncate">{entity.label}</span>
              <span
                className={`inline-flex min-w-7 shrink-0 justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                  isActive ? "bg-black/15 text-black" : "bg-white/8 text-zinc-300"
                }`}
              >
                {formatCount(entity.count)}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function formatCount(count: number | undefined) {
  if (count === undefined) return "-";
  return new Intl.NumberFormat("en-US", { notation: count > 9999 ? "compact" : "standard" }).format(count);
}
