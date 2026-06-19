"use client";

import { ChevronDown, Database, LayoutDashboard } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildMenuGroups,
  getEntityIcon,
  getGroupKeyForEntity,
  type MenuGroup,
} from "@/app/_lib/admin-menu-groups";
import type { EntityConfig } from "@/app/_lib/admin-types";
import { DASHBOARD_SCREEN_KEY } from "@/app/_lib/admin-screens";

type LeftMenuProps = {
  entities: EntityConfig[];
  activeKey: string;
  onSelect: (key: string) => void;
};

export function LeftMenu({ entities, activeKey, onSelect }: LeftMenuProps) {
  const groups = useMemo(() => buildMenuGroups(entities), [entities]);
  const activeGroupKey = useMemo(() => getGroupKeyForEntity(activeKey, groups), [activeKey, groups]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!activeGroupKey) return;
    setOpenGroups((current) => ({ ...current, [activeGroupKey]: true }));
  }, [activeGroupKey]);

  const toggleGroup = (groupKey: string) => {
    setOpenGroups((current) => ({ ...current, [groupKey]: !current[groupKey] }));
  };

  return (
    <aside className="border-b border-white/10 bg-[#050806]/88 px-3 py-4 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden lg:border-b-0 lg:border-r">
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-4 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400 text-black shadow-[0_0_28px_rgba(30,215,96,0.24)]">
            <Database className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-300">AI Store</p>
            <h1 className="truncate text-xl font-black tracking-wide text-white">Admin Console</h1>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto pr-1">
          <button
            onClick={() => onSelect(DASHBOARD_SCREEN_KEY)}
            className={`mb-2 flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold transition ${
              activeKey === DASHBOARD_SCREEN_KEY
                ? "bg-emerald-400 text-black shadow-[0_0_24px_rgba(30,215,96,0.22)]"
                : "text-zinc-300 hover:bg-white/8 hover:text-white"
            }`}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">Dashboard</span>
          </button>

          <div className="my-3 h-px bg-white/10" />

          <div className="grid gap-2">
            {groups.map((group) => (
              <MenuGroupSection
                key={group.key}
                group={group}
                activeKey={activeKey}
                isOpen={Boolean(openGroups[group.key])}
                onToggle={() => toggleGroup(group.key)}
                onSelect={onSelect}
              />
            ))}
          </div>
        </nav>
      </div>
    </aside>
  );
}

function MenuGroupSection({
  group,
  activeKey,
  isOpen,
  onToggle,
  onSelect,
}: {
  group: MenuGroup;
  activeKey: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (key: string) => void;
}) {
  const Icon = group.icon;
  const hasActiveItem = group.entities.some((entity) => entity.key === activeKey);

  return (
    <section className="rounded-lg border border-white/8 bg-white/[0.025]">
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-11 w-full items-center gap-2 rounded-lg px-3 text-left transition ${
          hasActiveItem ? "text-emerald-200" : "text-zinc-300 hover:bg-white/6 hover:text-white"
        }`}
        aria-expanded={isOpen}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-black">{group.label}</span>
        <span className="inline-flex min-w-7 shrink-0 justify-center rounded-full bg-white/8 px-2 py-0.5 text-xs font-semibold text-zinc-300">
          {formatCount(group.count)}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen ? (
        <div className="grid gap-1 px-2 pb-2">
          {group.entities.map((entity) => (
            <MenuEntityButton
              key={entity.key}
              entity={entity}
              isActive={activeKey === entity.key}
              onSelect={() => onSelect(entity.key)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function MenuEntityButton({
  entity,
  isActive,
  onSelect,
}: {
  entity: EntityConfig;
  isActive: boolean;
  onSelect: () => void;
}) {
  const Icon = getEntityIcon(entity.key);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex h-9 items-center justify-between gap-2 rounded-md px-2 text-left text-sm font-medium transition ${
        isActive
          ? "bg-emerald-400 text-black shadow-[0_0_24px_rgba(30,215,96,0.18)]"
          : "text-zinc-400 hover:bg-white/8 hover:text-white"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate">{entity.label}</span>
      </span>
      <span
        className={`inline-flex min-w-7 shrink-0 justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
          isActive ? "bg-black/15 text-black" : "bg-white/8 text-zinc-300"
        }`}
      >
        {formatCount(entity.count)}
      </span>
    </button>
  );
}

function formatCount(count: number | undefined) {
  if (count === undefined) return "-";
  return new Intl.NumberFormat("en-US", { notation: count > 9999 ? "compact" : "standard" }).format(count);
}
