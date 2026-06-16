import { AlertCircle, Check } from "lucide-react";
import type { Toast } from "@/app/_lib/admin-types";

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed right-4 top-4 z-50 grid w-[min(420px,calc(100vw-2rem))] gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-in flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-2xl ${
            toast.type === "success"
              ? "border-emerald-300/30 bg-emerald-950/95 text-emerald-100"
              : "border-red-300/30 bg-red-950/95 text-red-100"
          }`}
        >
          {toast.type === "success" ? (
            <Check className="mt-0.5 h-4 w-4" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4" />
          )}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
