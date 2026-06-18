"use client";

import { useQuery } from "@tanstack/react-query";
import { Headphones, MessageCircle, PackageCheck, ReceiptText, UserRound, WalletCards } from "lucide-react";
import { getProfileSummary } from "@/features/orders/order-service";
import { EmptyState } from "./empty-state";

const text = {
  title: "Tài khoản",
  subtitle: "Thống kê mua hàng và hỗ trợ trực tiếp.",
  telegramRequired: "Vui lòng mở Mini App từ Telegram để xem tài khoản.",
  totalSpent: "Đã chi trả",
  orderCount: "Đơn đã mua",
  accountCount: "Tài khoản",
  serviceStats: "Tài khoản theo dịch vụ",
  emptyServiceTitle: "Chưa có dịch vụ đã mua",
  emptyServiceText: "Sau khi thanh toán thành công, số tài khoản theo từng dịch vụ sẽ hiển thị tại đây.",
  support: "Hỗ trợ",
  chatAdmin: "Chat với admin",
};

export function ProfileView({ initData }: { initData?: string }) {
  const profileQuery = useQuery({
    queryKey: ["profile-summary", initData],
    queryFn: () => getProfileSummary(initData!),
    enabled: Boolean(initData),
  });

  if (!initData) {
    return <EmptyState title={text.title} text={text.telegramRequired} />;
  }

  if (profileQuery.isLoading) {
    return (
      <section className="mini-fade space-y-3">
        <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.045]" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/[0.045]" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-xl border border-white/10 bg-white/[0.045]" />
      </section>
    );
  }

  const profile = profileQuery.data;
  if (!profile) {
    return <EmptyState title={text.title} text="Không tải được thông tin tài khoản." />;
  }

  const displayName = profile.user.fullName || profile.user.username || "AI Store user";
  const supportUsername = normalizeTelegramUsername(profile.support.telegram);
  const supportUrl = `https://t.me/${supportUsername}`;

  return (
    <section className="mini-fade space-y-4">
      <header className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 shadow-xl shadow-black/20">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/35 text-emerald-300">
            <UserRound className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">{text.title}</p>
            <h2 className="mt-1 truncate text-2xl font-bold text-white">{displayName}</h2>
            <p className="mt-1 text-sm leading-5 text-zinc-400">{text.subtitle}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <MetricCard icon={<WalletCards className="h-4 w-4" />} label={text.totalSpent} value={`${formatMoney(profile.stats.totalSpent)} đ`} />
        <MetricCard icon={<ReceiptText className="h-4 w-4" />} label={text.orderCount} value={String(profile.stats.orderCount)} />
        <MetricCard icon={<PackageCheck className="h-4 w-4" />} label={text.accountCount} value={String(profile.stats.accountCount)} />
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.045] p-3 shadow-lg shadow-black/20">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-white">{text.serviceStats}</h3>
          <span className="rounded-full bg-black/35 px-2.5 py-1 text-xs font-bold text-emerald-200">
            {profile.serviceStats.length} dịch vụ
          </span>
        </div>

        {profile.serviceStats.length ? (
          <div className="space-y-2">
            {profile.serviceStats.map((service, index) => (
              <article
                key={service.productId}
                className="mini-rise rounded-lg border border-white/10 bg-black/25 p-3"
                style={{ animationDelay: `${index * 34}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-bold leading-5 text-white">{service.serviceName}</p>
                    <p className="mt-1 text-xs font-semibold text-zinc-500">
                      {formatMoney(service.totalSpent)} đ đã chi trả
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-300 px-2.5 py-1 text-xs font-bold text-black">
                    {service.accountCount} tài khoản
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm leading-5 text-zinc-400">
            <p className="font-bold text-white">{text.emptyServiceTitle}</p>
            <p className="mt-1">{text.emptyServiceText}</p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-3 shadow-lg shadow-black/20">
        <div className="mb-3 flex items-center gap-2 text-emerald-200">
          <Headphones className="h-4 w-4" />
          <h3 className="text-base font-bold text-white">{text.support}</h3>
        </div>
        <a
          href={supportUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 text-sm font-bold text-black transition hover:bg-emerald-200"
        >
          <MessageCircle className="h-4 w-4" />
          {text.chatAdmin} @{supportUsername}
        </a>
      </section>
    </section>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.045] p-3 shadow-lg shadow-black/20">
      <div className="mb-2 text-emerald-300">{icon}</div>
      <p className="text-[11px] font-semibold leading-4 text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold leading-5 text-white">{value}</p>
    </article>
  );
}

function normalizeTelegramUsername(value?: string | null) {
  const username = (value || "hieuhv203").trim().replace(/^@/, "");
  return username || "hieuhv203";
}

function formatMoney(value: string | number) {
  return Number(value).toLocaleString("vi-VN");
}
