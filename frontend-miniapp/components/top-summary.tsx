import { Bot, ShieldCheck, Sparkles } from "lucide-react";

export function TopSummary({ cartCount }: { cartCount: number }) {
  return (
    <header className="mini-rise space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">AI Store</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Mua tài khoản số</h1>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-300/10 text-emerald-200 shadow-[0_0_24px_rgba(30,215,96,0.18)]">
          <Bot className="h-5 w-5" />
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-xs font-bold text-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              Telegram auto delivery
            </p>
            <h2 className="mt-3 text-2xl font-bold leading-tight text-white">Thanh toán nhanh, nhận hàng tức thì</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Chọn sản phẩm, xác nhận giỏ hàng và hệ thống sẽ tự động tạo đơn trong AI Store.
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center">
            <p className="text-2xl font-bold text-emerald-300">{cartCount}</p>
            <p className="text-[11px] font-semibold text-zinc-500">trong giỏ</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Bảo mật" value="Bot verified" />
          <Metric icon={<Sparkles className="h-4 w-4" />} label="Tốc độ" value="Tự động" />
        </div>
      </section>
    </header>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="flex items-center gap-2 text-emerald-300">
        {icon}
        <span className="text-xs font-semibold text-zinc-500">{label}</span>
      </div>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}
