import {
  Bell,
  Boxes,
  ClipboardList,
  Headphones,
  Megaphone,
  PackageSearch,
  ShieldCheck,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { EntityConfig } from "./admin-types";

export type MenuGroup = {
  key: string;
  label: string;
  icon: LucideIcon;
  entities: EntityConfig[];
  count: number;
};

const GROUPS: Array<{
  key: string;
  label: string;
  icon: LucideIcon;
  entityKeys: string[];
}> = [
  {
    key: "catalog",
    label: "Catalog",
    icon: PackageSearch,
    entityKeys: ["categories", "products", "product-variants", "reviews"],
  },
  {
    key: "inventory",
    label: "Inventory",
    icon: Boxes,
    entityKeys: ["inventories", "deliveries"],
  },
  {
    key: "sales",
    label: "Sales",
    icon: ShoppingCart,
    entityKeys: ["orders", "order-items", "payments"],
  },
  {
    key: "customers",
    label: "Customers",
    icon: Users,
    entityKeys: ["users", "roles", "user-roles"],
  },
  {
    key: "marketing",
    label: "Marketing",
    icon: Megaphone,
    entityKeys: ["coupons", "coupon-products", "coupon-users", "coupon-usages"],
  },
  {
    key: "support",
    label: "Support",
    icon: Headphones,
    entityKeys: ["tickets", "notifications"],
  },
  {
    key: "security",
    label: "Security",
    icon: ShieldCheck,
    entityKeys: ["admin-login-tokens", "refresh-tokens", "audit-logs", "activity-logs"],
  },
];

const FALLBACK_GROUP = {
  key: "system",
  label: "System",
  icon: ClipboardList,
};

export function buildMenuGroups(entities: EntityConfig[]): MenuGroup[] {
  const entityMap = new Map(entities.map((entity) => [entity.key, entity]));
  const groupedKeys = new Set<string>();

  const groups = GROUPS.map((group) => {
    const groupEntities = group.entityKeys
      .map((entityKey) => entityMap.get(entityKey))
      .filter((entity): entity is EntityConfig => Boolean(entity));

    groupEntities.forEach((entity) => groupedKeys.add(entity.key));

    return {
      key: group.key,
      label: group.label,
      icon: group.icon,
      entities: groupEntities,
      count: sumEntityCounts(groupEntities),
    };
  }).filter((group) => group.entities.length > 0);

  const fallbackEntities = entities.filter((entity) => !groupedKeys.has(entity.key));
  if (fallbackEntities.length) {
    groups.push({
      key: FALLBACK_GROUP.key,
      label: FALLBACK_GROUP.label,
      icon: FALLBACK_GROUP.icon,
      entities: fallbackEntities,
      count: sumEntityCounts(fallbackEntities),
    });
  }

  return groups;
}

export function getGroupKeyForEntity(entityKey: string, groups: MenuGroup[]) {
  return groups.find((group) => group.entities.some((entity) => entity.key === entityKey))?.key;
}

export function getEntityIcon(entityKey: string): LucideIcon {
  if (entityKey === "notifications") return Bell;
  return ClipboardList;
}

function sumEntityCounts(entities: EntityConfig[]) {
  return entities.reduce((total, entity) => total + (entity.count || 0), 0);
}
