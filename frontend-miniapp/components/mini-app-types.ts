import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

export type TabKey = "home" | "categories" | "cart" | "orders" | "profile";

export type TabItem = {
  key: TabKey;
  label: string;
  icon: ComponentType<LucideProps>;
};

export type ToastState = {
  type: "success" | "error";
  message: string;
} | null;
