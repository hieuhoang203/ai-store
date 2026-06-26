import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  Search,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import type { EntityConfig, FieldConfig, ListResponse } from "@/app/_lib/admin-types";
import { renderValue } from "@/app/_lib/admin-format";
import { IconButton } from "./icon-button";

type EntityListViewProps = {
  entity?: EntityConfig;
  list: ListResponse | null;
  listFields: FieldConfig[];
  search: string;
  page: number;
  loading: boolean;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onDetail: (record: Record<string, unknown>) => void;
  onEdit: (record: Record<string, unknown>) => void;
  onDelete: (record: Record<string, unknown>) => void;
};

export function EntityListView({
  entity,
  list,
  listFields,
  search,
  page,
  loading,
  onSearchChange,
  onPageChange,
  onDetail,
  onEdit,
  onDelete,
}: EntityListViewProps) {
  return (
    <section className="smooth-panel mt-5 rounded-lg border border-white/10 bg-[#0b120d]/92 shadow-2xl shadow-black/30">
      <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-bold text-white">Danh sách dữ liệu</h3>
          <p className="text-sm text-zinc-400">
            {entity?.softDelete
              ? "Chỉ hiển thị bản ghi chưa bị xóa mềm, sắp xếp mới nhất."
              : "Sắp xếp theo ngày cập nhật hoặc ngày tạo mới nhất."}
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Tìm kiếm..."
            className="h-10 w-full rounded-lg border border-white/10 bg-black/35 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-emerald-300"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              {listFields.map((field) => (
                <th key={field.name} className="px-4 py-3 text-left text-xs font-bold uppercase text-zinc-400">
                  {field.label}
                </th>
              ))}
              <th className="w-36 px-4 py-3 text-right text-xs font-bold uppercase text-zinc-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <TableBody
              entity={entity}
              loading={loading}
              list={list}
              listFields={listFields}
              onDetail={onDetail}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-400">
          Tổng {list?.pagination.total || 0} bản ghi, trang {list?.pagination.page || 1}/
          {Math.max(list?.pagination.totalPages || 1, 1)}
        </p>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(page - 1, 1))}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>
          <button
            disabled={page >= (list?.pagination.totalPages || 1)}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

function InviteLinkCell({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const inviteLink = `${
    process.env.NEXT_PUBLIC_API_BASE_URL || "https://ai-store-lnin.onrender.com"
  }/suppliers/join?token=${token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs max-w-40 truncate" title={inviteLink}>
        {token}
      </span>
      <button
        onClick={handleCopy}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20 transition cursor-pointer"
        title="Sao chép Link mời"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function TableBody({
  entity,
  loading,
  list,
  listFields,
  onDetail,
  onEdit,
  onDelete,
}: {
  entity?: EntityConfig;
  loading: boolean;
  list: ListResponse | null;
  listFields: FieldConfig[];
  onDetail: (record: Record<string, unknown>) => void;
  onEdit: (record: Record<string, unknown>) => void;
  onDelete: (record: Record<string, unknown>) => void;
}) {
  if (loading) {
    return (
      <tr>
        <td colSpan={listFields.length + 1} className="px-4 py-14 text-center text-emerald-200">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
          Đang tải dữ liệu
        </td>
      </tr>
    );
  }

  if (!list?.data.length) {
    return (
      <tr>
        <td colSpan={listFields.length + 1} className="px-4 py-14 text-center text-sm text-zinc-400">
          Không có dữ liệu phù hợp
        </td>
      </tr>
    );
  }

  return list.data.map((record) => (
    <tr
      key={String(record.__recordId)}
      className="border-b border-white/8 transition hover:bg-emerald-300/[0.04]"
    >
      {listFields.map((field) => (
        <td key={field.name} className="max-w-56 truncate px-4 py-3 text-sm text-zinc-200">
          {entity?.key === "link-moi-nha-cung-cap" && field.name === "maToken" ? (
            <InviteLinkCell token={String(record[field.name])} />
          ) : (
            renderValue(field, record[field.name])
          )}
        </td>
      ))}
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          <IconButton title="Detail" onClick={() => onDetail(record)}>
            <Eye className="h-4 w-4" />
          </IconButton>
          <IconButton title="Update" onClick={() => onEdit(record)}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton title="Delete" danger onClick={() => onDelete(record)}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </td>
    </tr>
  ));
}
