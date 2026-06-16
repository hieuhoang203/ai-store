import { Activity, AlertCircle, BarChart3, Check, Database, ShoppingCart } from "lucide-react";
import type { Dashboard } from "@/app/_lib/admin-types";
import { formatNumber, money } from "@/app/_lib/admin-format";

export function DashboardView({ dashboard }: { dashboard: Dashboard | null }) {
  const cards = [
    ["users", "Users", Activity],
    ["products", "Products", Database],
    ["inventories", "Inventory", BarChart3],
    ["orders", "Orders", ShoppingCart],
    ["todayOrders", "Today", Activity],
    ["paidOrders", "Paid", Check],
    ["tickets", "Tickets", AlertCircle],
    ["revenue", "Revenue", BarChart3],
  ] as const;

  return (
    <section className="smooth-panel grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(([key, label, Icon]) => (
        <div key={key} className="rounded-lg border border-white/10 bg-black/36 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-400">{label}</span>
            <Icon className="h-4 w-4 text-emerald-300" />
          </div>
          <div className="text-2xl font-black text-white">
            {key === "revenue"
              ? money.format(Number(dashboard?.cards?.[key] || 0))
              : formatNumber(dashboard?.cards?.[key] || 0)}
          </div>
        </div>
      ))}
    </section>
  );
}
