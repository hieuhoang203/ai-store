"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Send, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import {
  connectSupplier,
  fulfillSupplierRequest,
  getSupplierRequest,
  type SupplierConnectResult,
} from "@/features/suppliers/supplier-service";
import { EmptyState } from "./empty-state";

export function SupplierWorkspace({
  initData,
  requestToken,
  inviteToken,
}: {
  initData?: string;
  requestToken?: string | null;
  inviteToken?: string | null;
}) {
  const [connectResult, setConnectResult] = useState<SupplierConnectResult | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [payloadText, setPayloadText] = useState(defaultPayloadText);
  const [message, setMessage] = useState("");

  const requestQuery = useQuery({
    queryKey: ["supplier-request", requestToken, initData],
    queryFn: () => getSupplierRequest(requestToken!, initData!),
    enabled: Boolean(requestToken && initData),
  });

  const connectMutation = useMutation({
    mutationFn: () =>
      connectSupplier({
        initData: initData!,
        displayName,
        phone,
        email,
        token: inviteToken || undefined,
      }),
    onSuccess: (result) => {
      setConnectResult(result);
      setMessage("Da ket noi nha cung cap thanh cong.");
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Khong the ket noi nha cung cap."),
  });

  useEffect(() => {
    if (
      initData &&
      inviteToken &&
      !connectResult &&
      !connectMutation.isPending &&
      !connectMutation.isSuccess &&
      !connectMutation.isError
    ) {
      connectMutation.mutate();
    }
  }, [initData, inviteToken, connectResult, connectMutation]);

  const fulfillMutation = useMutation({
    mutationFn: () => fulfillSupplierRequest(requestToken!, { initData: initData!, payload: parsePayload(payloadText) }),
    onSuccess: () => setMessage("Da gui ket qua cho don hang."),
    onError: (error) => setMessage(error instanceof Error ? error.message : "Khong the gui ket qua."),
  });

  if (!initData) {
    return <EmptyState title="Nha cung cap" text="Vui long mo link nay trong Telegram Mini App de xac thuc tai khoan." />;
  }

  return (
    <main className="mx-auto flex h-screen min-h-[100dvh] max-w-md flex-col overflow-y-auto border-x border-white/10 bg-[#050805]/72 px-4 py-5 shadow-2xl shadow-black/50">
      <section className="space-y-4">
        <header className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/35 text-emerald-300">
              <UserRound className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Supplier</p>
              <h1 className="mt-1 text-2xl font-bold text-white">Ket noi nha cung cap</h1>
              <p className="mt-1 text-sm leading-5 text-zinc-400">Tai khoan Telegram se duoc luu vao ho so nha cung cap.</p>
            </div>
          </div>
        </header>

        {inviteToken && connectResult ? (
          <section className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-5 text-center space-y-3">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300 animate-bounce" />
            <h2 className="text-xl font-bold text-white">Tham gia thành công!</h2>
            <p className="text-sm text-zinc-300 leading-5">
              Tài khoản Telegram của bạn đã được kết nối với nhà cung cấp.
            </p>
            <div className="rounded-lg bg-black/35 p-3 text-left text-xs font-mono text-emerald-200/90 space-y-1">
              <p>Nhà cung cấp: {connectResult.supplier.displayName}</p>
              <p>Telegram: @{connectResult.supplier.username || "-"}</p>
              <p>ID: {connectResult.supplier.telegramId}</p>
            </div>
          </section>
        ) : inviteToken && connectMutation.isPending ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 text-center space-y-4">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-300" />
            <p className="text-sm text-zinc-400">Đang liên kết tài khoản nhà cung cấp...</p>
          </section>
        ) : (
          <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="space-y-3">
              <Field label="Ten hien thi" value={displayName} onChange={setDisplayName} placeholder="Ten shop/doi tac" />
              <Field label="So dien thoai" value={phone} onChange={setPhone} placeholder="090..." />
              <Field label="Email" value={email} onChange={setEmail} placeholder="supplier@example.com" />
              <button
                type="button"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 text-sm font-bold text-black disabled:opacity-60"
              >
                {connectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Ket noi
              </button>
            </div>

            {connectResult ? (
              <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">
                <p className="font-bold">{connectResult.supplier.displayName}</p>
                <p className="mt-1 break-words">@{connectResult.supplier.username || "-"}</p>
                <p className="mt-1 break-words">Telegram ID: {connectResult.supplier.telegramId || "-"}</p>
              </div>
            ) : null}
          </section>
        )}

        {requestToken ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <h2 className="text-lg font-bold text-white">Yeu cau can xu ly</h2>
            {requestQuery.isLoading ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-emerald-200">
                <Loader2 className="h-4 w-4 animate-spin" />
                Dang tai yeu cau
              </div>
            ) : requestQuery.data ? (
              <div className="mt-3 space-y-3">
                <Info label="Ma yeu cau" value={requestQuery.data.code} />
                <Info label="Don hang" value={requestQuery.data.order.orderNo} />
                <Info label="Dich vu" value={`${requestQuery.data.product.name} - ${requestQuery.data.product.variantName}`} />
                <Info label="So luong" value={String(requestQuery.data.quantity)} />
                <Info label="Du lieu khach nhap" value={JSON.stringify(requestQuery.data.customerInput || {}, null, 2)} pre />
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-zinc-200">Ket qua giao hang JSON</span>
                  <textarea
                    value={payloadText}
                    onChange={(event) => setPayloadText(event.target.value)}
                    rows={8}
                    className="w-full resize-y rounded-lg border border-white/10 bg-black/35 px-3 py-2 font-mono text-xs leading-5 text-white outline-none focus:border-emerald-300/50"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => fulfillMutation.mutate()}
                  disabled={fulfillMutation.isPending}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 text-sm font-bold text-black disabled:opacity-60"
                >
                  {fulfillMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Gui ket qua
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-400">Khong tim thay yeu cau.</p>
            )}
          </section>
        ) : null}

        {message ? <p className="rounded-lg border border-white/10 bg-black/35 p-3 text-sm text-zinc-100">{message}</p> : null}
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-zinc-200">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-300/50"
      />
    </label>
  );
}

function Info({ label, value, pre }: { label: string; value: string; pre?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
      <p className="mb-1 text-xs font-bold uppercase text-zinc-500">{label}</p>
      {pre ? (
        <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-zinc-100">{value}</pre>
      ) : (
        <p className="break-words text-sm font-bold text-white">{value}</p>
      )}
    </div>
  );
}

function parsePayload(value: string) {
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Payload phai la JSON object.");
  }
  return parsed as Record<string, unknown>;
}

const defaultPayloadText = JSON.stringify(
  {
    accounts: [
      {
        email: "customer@example.com",
        password: "password",
        note: "delivery note",
      },
    ],
  },
  null,
  2,
);
