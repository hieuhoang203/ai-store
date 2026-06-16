import { Brain, Brush, GraduationCap, MonitorPlay, Shield, WandSparkles } from "lucide-react";
import { SectionTitle } from "./section-title";

const categories = [
  { label: "AI", count: "Assistant", icon: Brain },
  { label: "Streaming", count: "Media", icon: MonitorPlay },
  { label: "Design", count: "Creative", icon: Brush },
  { label: "Productivity", count: "Office", icon: WandSparkles },
  { label: "VPN", count: "Security", icon: Shield },
  { label: "Education", count: "Learning", icon: GraduationCap },
];

export function CategoryView() {
  return (
    <section className="mini-fade space-y-3">
      <SectionTitle title="Danh mục" />
      <div className="grid grid-cols-2 gap-3">
        {categories.map((category, index) => {
          const Icon = category.icon;
          return (
            <button
              key={category.label}
              className="mini-rise rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-left transition hover:border-emerald-300/40 hover:bg-emerald-300/10"
              style={{ animationDelay: `${index * 42}ms` }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-300/10 text-emerald-300">
                <Icon className="h-5 w-5" />
              </span>
              <span className="mt-4 block text-base font-black text-white">{category.label}</span>
              <span className="mt-1 block text-xs font-semibold text-zinc-500">{category.count}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
