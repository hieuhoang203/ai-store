import { CheckCircle2, XCircle } from "lucide-react";
import type { ToastState } from "./mini-app-types";

export function ToastBanner({ toast }: { toast: ToastState }) {
  if (!toast) return null;

  const Icon = toast.type === "success" ? CheckCircle2 : XCircle;
  const color = toast.type === "success" ? "border-emerald-300/30 text-emerald-200" : "border-red-400/30 text-red-200";

  return (
    <div className={`mini-rise fixed left-1/2 top-4 z-30 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border bg-[#071008]/95 p-3 text-sm font-bold shadow-2xl shadow-black/50 backdrop-blur ${color}`}>
      <Icon className="h-5 w-5 shrink-0" />
      <span>{toast.message}</span>
    </div>
  );
}
