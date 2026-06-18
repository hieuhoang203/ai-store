"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Headphones,
  MessageCircle,
  PackageCheck,
  ReceiptText,
  Search,
  Ticket,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { getMyTickets, getProfileSummary, type MyTicket, type ProfileSummary } from "@/features/orders/order-service";
import { EmptyState } from "./empty-state";

type ProfileTab = "services" | "tickets";
type TicketFilter = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

const text = {
  title: "Tài khoản",
  subtitle: "Tổng quan mua hàng và hỗ trợ.",
  telegramRequired: "Vui lòng mở Mini App từ Telegram để xem tài khoản.",
  totalSpent: "Đã chi trả",
  orderCount: "Đơn hàng",
  accountCount: "Tài khoản",
  serviceCount: "Dịch vụ",
  services: "Dịch vụ",
  tickets: "Ticket",
  topServices: "Dịch vụ đang dùng",
  emptyServiceTitle: "Chưa có dịch vụ đã mua",
  emptyServiceText: "Sau khi thanh toán thành công, dữ liệu dịch vụ sẽ hiển thị tại đây.",
  emptyTicketTitle: "Chưa có ticket",
  emptyTicketText: "Các yêu cầu bảo hành và hỗ trợ của bạn sẽ hiển thị tại đây.",
  support: "Hỗ trợ trực tiếp",
  chatAdmin: "Chat với admin",
  searchTicket: "Tìm ticket",
};

const ticketFilters: TicketFilter[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export function ProfileView({ initData }: { initData?: string }) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("services");
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>("OPEN");
  const [ticketSearch, setTicketSearch] = useState("");
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

  const tickets = ticketsQuery.data || [];
  const filteredTickets = useMemo(
    () => filterTickets(tickets, ticketFilter, ticketSearch),
    [ticketFilter, ticketSearch, tickets],
  );
  const ticketCounts = useMemo(() => countTicketsByStatus(tickets), [tickets]);

  if (!initData) {
    return <EmptyState title={text.title} text={text.telegramRequired} />;
  }

  if (profileQuery.isLoading) {
    return <ProfileSkeleton />;
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
      <ProfileHero displayName={displayName} username={profile.user.username} />
      <MetricGrid profile={profile} />

      <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 shadow-xl shadow-black/20">
        <SegmentedTabs activeTab={activeTab} onChange={setActiveTab} ticketCount={tickets.length} />

        {activeTab === "services" ? (
          <ServicesPanel profile={profile} />
        ) : (
          <TicketsPanel
            tickets={filteredTickets}
            loading={ticketsQuery.isLoading}
            filter={ticketFilter}
            counts={ticketCounts}
            search={ticketSearch}
            onFilterChange={setTicketFilter}
            onSearchChange={setTicketSearch}
            onSelect={setSelectedTicket}
          />
        )}
      </section>

      <SupportPanel supportUrl={supportUrl} supportUsername={supportUsername} />

      {selectedTicket ? (
        <TicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      ) : null}
    </section>
  );
}

function ProfileHero({ displayName, username }: { displayName: string; username?: string | null }) {
  return (
    <header className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 shadow-xl shadow-black/20">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/35 text-emerald-300">
          <UserRound className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">{text.title}</p>
          <h2 className="mt-1 truncate text-2xl font-bold text-white">{displayName}</h2>
          <p className="mt-1 truncate text-sm leading-5 text-zinc-400">
            {username ? `@${username}` : text.subtitle}
          </p>
        </div>
      </div>
    </header>
  );
}

function MetricGrid({ profile }: { profile: ProfileSummary }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <MetricCard icon={<WalletCards className="h-4 w-4" />} label={text.totalSpent} value={`${formatMoney(profile.stats.totalSpent)} đ`} featured />
      <MetricCard icon={<PackageCheck className="h-4 w-4" />} label={text.accountCount} value={String(profile.stats.accountCount)} />
      <MetricCard icon={<ReceiptText className="h-4 w-4" />} label={text.orderCount} value={String(profile.stats.orderCount)} />
      <MetricCard icon={<PackageCheck className="h-4 w-4" />} label={text.serviceCount} value={String(profile.serviceStats.length)} />
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  featured,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  featured?: boolean;
}) {
  return (
    <article className={`rounded-xl border p-3 shadow-lg shadow-black/20 ${featured ? "border-emerald-300/25 bg-emerald-300/10" : "border-white/10 bg-white/[0.045]"}`}>
      <div className="mb-2 text-emerald-300">{icon}</div>
      <p className="text-[11px] font-semibold leading-4 text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-base font-bold leading-5 text-white">{value}</p>
    </article>
  );
}

function SegmentedTabs({
  activeTab,
  ticketCount,
  onChange,
}: {
  activeTab: ProfileTab;
  ticketCount: number;
  onChange: (tab: ProfileTab) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/25 p-1">
      <SegmentButton active={activeTab === "services"} onClick={() => onChange("services")}>
        <PackageCheck className="h-4 w-4" />
        {text.services}
      </SegmentButton>
      <SegmentButton active={activeTab === "tickets"} onClick={() => onChange("tickets")}>
        <Ticket className="h-4 w-4" />
        {text.tickets}
        {ticketCount > 0 ? (
          <span className="rounded-full bg-black/25 px-1.5 text-[10px] font-bold">{ticketCount}</span>
        ) : null}
      </SegmentButton>
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-bold transition ${
        active ? "bg-emerald-300 text-black" : "text-zinc-300 hover:bg-white/8 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function ServicesPanel({ profile }: { profile: ProfileSummary }) {
  const maxAccountCount = Math.max(...profile.serviceStats.map((service) => service.accountCount), 1);

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-white">{text.topServices}</h3>
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
              style={{ animationDelay: `${index * 28}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-bold leading-5 text-white">{service.serviceName}</p>
                  <p className="mt-1 text-xs font-semibold text-zinc-500">
                    {formatMoney(service.totalSpent)} đ
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-300 px-2.5 py-1 text-xs font-bold text-black">
                  {service.accountCount}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-emerald-300"
                  style={{ width: `${Math.max((service.accountCount / maxAccountCount) * 100, 8)}%` }}
                />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyPanel title={text.emptyServiceTitle} text={text.emptyServiceText} />
      )}
    </div>
  );
}

function TicketsPanel({
  tickets,
  loading,
  filter,
  counts,
  search,
  onFilterChange,
  onSearchChange,
  onSelect,
}: {
  tickets: MyTicket[];
  loading: boolean;
  filter: TicketFilter;
  counts: Record<TicketFilter, number>;
  search: string;
  onFilterChange: (filter: TicketFilter) => void;
  onSearchChange: (value: string) => void;
  onSelect: (ticket: MyTicket) => void;
}) {
  return (
    <div className="mt-3 space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={text.searchTicket}
          className="h-10 w-full rounded-lg border border-white/10 bg-black/25 pl-9 pr-3 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/50"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ticketFilters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onFilterChange(item)}
            className={`h-9 rounded-lg px-2 text-xs font-bold transition ${
              filter === item ? "bg-emerald-300 text-black" : "bg-black/35 text-zinc-300"
            }`}
          >
            {formatTicketFilter(item)} {counts[item] ? `(${counts[item]})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-lg border border-white/10 bg-black/25" />
          ))}
        </div>
      ) : tickets.length ? (
        <div className="space-y-2">
          {tickets.map((ticket, index) => (
            <TicketCard key={ticket.id} ticket={ticket} index={index} onSelect={() => onSelect(ticket)} />
          ))}
        </div>
      ) : (
        <EmptyPanel title={text.emptyTicketTitle} text={text.emptyTicketText} />
      )}
    </div>
  );
}

function TicketCard({ ticket, index, onSelect }: { ticket: MyTicket; index: number; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="mini-rise w-full rounded-lg border border-white/10 bg-black/25 p-3 text-left transition hover:border-emerald-300/35 hover:bg-emerald-300/10"
      style={{ animationDelay: `${index * 28}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-emerald-200">{ticket.code}</p>
            {ticket.order ? <span className="text-xs font-semibold text-zinc-500">{ticket.order.orderNo}</span> : null}
          </div>
          <p className="mt-1 line-clamp-1 text-sm font-bold text-white">{ticket.subject}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{ticket.content}</p>
        </div>
        <StatusPill status={ticket.status} />
      </div>
    </button>
  );
}

function SupportPanel({ supportUrl, supportUsername }: { supportUrl: string; supportUsername: string }) {
  return (
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
  );
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

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm leading-5 text-zinc-400">
      <p className="font-bold text-white">{title}</p>
      <p className="mt-1">{text}</p>
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

function ProfileSkeleton() {
  return (
    <section className="mini-fade space-y-3">
      <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.045]" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/[0.045]" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-white/10 bg-white/[0.045]" />
    </section>
  );
}

function filterTickets(tickets: MyTicket[], filter: TicketFilter, search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  return tickets.filter((ticket) => {
    const statusMatched = ticket.status === filter;
    if (!statusMatched) return false;
    if (!normalizedSearch) return true;

    return [ticket.code, ticket.subject, ticket.content, ticket.order?.orderNo]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch));
  });
}

function countTicketsByStatus(tickets: MyTicket[]) {
  return ticketFilters.reduce(
    (result, filter) => ({
      ...result,
      [filter]: tickets.filter((ticket) => ticket.status === filter).length,
    }),
    {} as Record<TicketFilter, number>,
  );
}

function formatTicketFilter(filter: TicketFilter) {
  if (filter === "IN_PROGRESS") return "Đang xử lý";
  if (filter === "RESOLVED") return "Đã xử lý";
  if (filter === "CLOSED") return "Đã đóng";
  return "Mới tạo";
}

function formatTicketStatus(status: string) {
  if (status === "IN_PROGRESS") return "Đang xử lý";
  if (status === "RESOLVED") return "Đã xử lý";
  if (status === "CLOSED") return "Đã đóng";
  return "Mới tạo";
}

function normalizeTelegramUsername(value?: string | null) {
  const username = (value || "hieuhv203").trim().replace(/^@/, "");
  return username || "hieuhv203";
}

function formatMoney(value: string | number) {
  return Number(value).toLocaleString("vi-VN");
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
