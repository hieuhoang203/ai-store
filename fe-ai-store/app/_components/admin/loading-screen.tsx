import { Loader2 } from "lucide-react";

export function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3 text-sm font-medium text-emerald-200">
        <Loader2 className="h-5 w-5 animate-spin" />
        Đang khởi tạo bảng quản trị
      </div>
    </main>
  );
}
