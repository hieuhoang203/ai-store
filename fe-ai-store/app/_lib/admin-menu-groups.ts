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
    key: "danh-muc",
    label: "Danh mục sản phẩm",
    icon: PackageSearch,
    entityKeys: ["loai-san-pham", "san-pham", "goi-dich-vu", "phuong-thuc-giao-hang", "goi-phuong-thuc", "danh-gia"],
  },
  {
    key: "giao-hang-va-supplier",
    label: "Giao hàng & supplier",
    icon: Boxes,
    entityKeys: [
      "nha-cung-cap",
      "link-moi-nha-cung-cap",
      "supplier-goi-dich-vu",
      "tai-nguyen-giao-hang",
      "yeu-cau-nha-cung-cap",
      "giao-hang",
    ],
  },
  {
    key: "ban-hang",
    label: "Bán hàng",
    icon: ShoppingCart,
    entityKeys: ["don-hang", "chi-tiet-don-hang", "thanh-toan"],
  },
  {
    key: "nguoi-dung",
    label: "Người dùng",
    icon: Users,
    entityKeys: ["nguoi-dung", "vai-tro"],
  },
  {
    key: "marketing",
    label: "Marketing",
    icon: Megaphone,
    entityKeys: ["ma-giam-gia"],
  },
  {
    key: "ho-tro",
    label: "Hỗ trợ",
    icon: Headphones,
    entityKeys: ["ticket-ho-tro", "thong-bao"],
  },
  {
    key: "he-thong",
    label: "Hệ thống",
    icon: ShieldCheck,
    entityKeys: ["audit-log"],
  },
];

const FALLBACK_GROUP = {
  key: "khac",
  label: "Khác",
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
  if (entityKey === "thong-bao") return Bell;
  return ClipboardList;
}

function sumEntityCounts(entities: EntityConfig[]) {
  return entities.reduce((total, entity) => total + (entity.count || 0), 0);
}
