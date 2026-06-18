"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Headphones, MessageCircle, PackageCheck, ReceiptText, Ticket, UserRound, WalletCards, X } from "lucide-react";
import { getMyTickets, getProfileSummary, type MyTicket } from "@/features/orders/order-service";
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
  tickets: "Ticket của tôi",
  emptyTicketTitle: "Chưa có ticket",
  emptyTicketText: "Các yêu cầu bảo hành và hỗ trợ của bạn sẽ hiển thị tại đây.",
};

export function ProfileView({ initData }: { initData?: string }) {
  const [selectedTicket, setSelectedTicket] = useState<MyTicket | null>(null);
  const profileQuery = useQuery({
    queryKey: ["profile-summary", initData],
    queryFn: () => getProfileSummary(initData!),
    enabled: Boolean(initData),
  });
  const ticketsQuery = useQuery({
    queryKey: ["my-tickets", initData],
    queryFn: () => getMyTickets(initData!),
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

      <section className="rounded-xl border border-white/10 bg-white/[0.045] p-3 shadow-lg shadow-black/20">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-emerald-300" />
            <h3 className="text-base font-bold text-white">{text.tickets}</h3>
          </div>
          <span className="rounded-full bg-black/35 px-2.5 py-1 text-xs font-bold text-emerald-200">
            {ticketsQuery.data?.length || 0} ticket
          </span>
        </div>

        {ticketsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-lg border border-white/10 bg-black/25" />
            ))}
          </div>
        ) : ticketsQuery.data?.length ? (
          <div className="space-y-2">
            {ticketsQuery.data.map((ticket, index) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => setSelectedTicket(ticket)}
                className="mini-rise w-full rounded-lg border border-white/10 bg-black/25 p-3 text-left transition hover:border-emerald-300/35 hover:bg-emerald-300/10"
                style={{ animationDelay: `${index * 34}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-emerald-200">{ticket.code}</p>
                    <p className="mt-1 line-clamp-1 text-sm font-bold text-white">{ticket.subject}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{ticket.content}</p>
                  </div>
                  <StatusPill status={ticket.status} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm leading-5 text-zinc-400">
            <p className="font-bold text-white">{text.emptyTicketTitle}</p>
            <p className="mt-1">{text.emptyTicketText}</p>
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

      {selectedTicket ? (
        <TicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      ) : null}
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

function StatusPill({ status }: { status: string }) {
  const label = formatTicketStatus(status);
  const className =
    status === "RESOLVED"
      ? "bg-emerald-300 text-black"
      : status === "CLOSED"
        ? "bg-zinc-700 text-zinc-200"
        : status === "IN_PROGRESS"
          ? "bg-amber-300 text-black"
          : "bg-white/10 text-zinc-200";

  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${className}`}>
      {label}
    </span>
  );
}

function TicketDetailModal({ ticket, onClose }: { ticket: MyTicket; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-[max(24px,env(safe-area-inset-top))] backdrop-blur-sm">
      <section className="mini-rise flex max-h-[min(82dvh,560px)] w-full max-w-md flex-col rounded-2xl border border-white/10 bg-[#071008] shadow-2xl shadow-black/60">
        <div className="shrink-0 border-b border-white/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Chi tiết ticket</p>
              <h3 className="mt-1 break-words text-xl font-bold text-white">{ticket.code}</h3>
              <p className="mt-1 text-sm font-semibold text-zinc-400">{formatDateTime(ticket.createdAt)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.045] text-zinc-200"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
          <InfoRow label="Trạng thái" value={formatTicketStatus(ticket.status)} important />
          {ticket.order ? <InfoRow label="Đơn hàng" value={ticket.order.orderNo} /> : null}
          <InfoRow label="Chủ đề" value={ticket.subject} />
          <div className="rounded-lg border border-white/10 bg-black/25 p-3">
            <p className="mb-2 text-xs font-bold uppercase text-zinc-500">Nội dung</p>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-zinc-100">
              {ticket.content}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoRow({ label, value, important }: { label: string; value: string; important?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
      <p className="mb-1 text-xs font-bold uppercase text-zinc-500">{label}</p>
      <p className={`break-words text-sm font-bold ${important ? "text-emerald-200" : "text-white"}`}>{value}</p>
    </div>
  );
}

function formatTicketStatus(status: string) {
  if (status === "IN_PROGRESS") return "Đang xử lý";
  if (status === "RESOLVED") return "Đã xử lý";
  if (status === "CLOSED") return "Đã đóng";
  return "Mới tạo";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
