"use client";

import { Plus, RefreshCw, X } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createEntity,
  deleteEntity,
  getAdminEntities,
  getDashboard,
  getEntityDetail,
  getEntityList,
  updateEntity,
} from "@/app/_lib/admin-api";
import { buildPayload, toFormValues } from "@/app/_lib/admin-format";
import { DASHBOARD_SCREEN_KEY, isDashboardScreen } from "@/app/_lib/admin-screens";
import type {
  Dashboard,
  EntityConfig,
  FormValues,
  ListResponse,
  ModalState,
  Toast,
} from "@/app/_lib/admin-types";
import { DashboardView } from "./dashboard-view";
import { EntityListView } from "./entity-list-view";
import { EntityModal } from "./entity-modal";
import { LeftMenu } from "./left-menu";
import { LoadingScreen } from "./loading-screen";
import { ToastStack } from "./toast-stack";

export function AdminConsole() {
  const [entities, setEntities] = useState<EntityConfig[]>([]);
  const [activeKey, setActiveKey] = useState(DASHBOARD_SCREEN_KEY);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [list, setList] = useState<ListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState<FormValues>({});
  const [closeReasonModalOpen, setCloseReasonModalOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const activeEntity = useMemo(
    () => (isDashboardScreen(activeKey) ? undefined : entities.find((entity) => entity.key === activeKey)),
    [activeKey, entities],
  );

  const listFields = useMemo(
    () => activeEntity?.fields.filter((field) => field.list && !field.hidden).slice(0, 8) || [],
    [activeEntity],
  );

  const editableFields = useMemo(() => {
    if (!activeEntity || !modal || modal.type === "detail") return [];

    return activeEntity.fields.filter((field) => {
      if (field.hidden || field.readonly) return false;
      if (modal.type === "create" && field.create === false) return false;
      if (modal.type === "edit" && field.update === false) return false;
      return true;
    });
  }, [activeEntity, modal]);

  const showToast = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now();
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3600);
  }, []);

  const loadDashboard = useCallback(async () => {
    setDashboard(await getDashboard());
  }, []);

  const loadEntities = useCallback(async () => {
    setEntities(await getAdminEntities());
  }, []);

  const loadList = useCallback(async () => {
    if (!activeEntity) {
      setList(null);
      return;
    }

    setTableLoading(true);
    try {
      setList(await getEntityList(activeEntity.key, page, search));
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Không tải được danh sách");
    } finally {
      setTableLoading(false);
    }
  }, [activeEntity, page, search, showToast]);

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      try {
        await Promise.all([loadEntities(), loadDashboard()]);
      } catch (error) {
        showToast("error", error instanceof Error ? error.message : "Không kết nối được backend");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, [loadDashboard, loadEntities, showToast]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const selectEntity = (key: string) => {
    setActiveKey(key);
    setPage(1);
    setSearch("");
    setList(null);
    setModal(null);
  };

  const refreshAll = () => {
    if (isDashboardScreen(activeKey)) {
      return Promise.all([loadEntities(), loadDashboard()]);
    }

    return Promise.all([loadEntities(), loadDashboard(), loadList()]);
  };

  const openCreate = () => {
    if (!activeEntity) return;
    setForm({});
    setCloseReasonModalOpen(false);
    setCloseReason("");
    setModal({ type: "create" });
  };

  const openEdit = async (record: Record<string, unknown>) => {
    try {
      if (!activeEntity) return;
      const fullRecord = await getEntityDetail(activeEntity.key, record.__recordId);
      setForm(toFormValues(fullRecord));
      setCloseReasonModalOpen(false);
      setCloseReason("");
      setModal({ type: "edit", record: fullRecord });
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "KhÃ´ng táº£i Ä‘Æ°á»£c chi tiáº¿t");
    }
  };

  const openDetail = async (record: Record<string, unknown>) => {
    try {
      if (!activeEntity) return;
      const fullRecord = await getEntityDetail(activeEntity.key, record.__recordId);
      setModal({ type: "detail", record: fullRecord });
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Không tải được chi tiết");
    }
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeEntity || !modal || modal.type === "detail") return;

    if (shouldRequireCloseReason()) {
      setCloseReasonModalOpen(true);
      return;
    }

    await submitEntityForm();
  };

  const submitEntityForm = async (extraPayload: Record<string, unknown> = {}) => {
    if (!activeEntity || !modal || modal.type === "detail") return;

    try {
      const payload = {
        ...buildPayload(editableFields, form),
        ...extraPayload,
      };

      if (modal.type === "create") {
        await createEntity(activeEntity.key, payload);
        showToast("success", "Tạo bản ghi thành công");
      } else {
        await updateEntity(activeEntity.key, modal.record.__recordId, payload);
        showToast("success", "Cập nhật bản ghi thành công");
      }

      setModal(null);
      setCloseReasonModalOpen(false);
      setCloseReason("");
      await refreshAll();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Thao tác thất bại");
    }
  };

  const shouldRequireCloseReason = () => {
    if (!activeEntity || !modal || modal.type !== "edit") return false;
    if (activeEntity.key !== "tickets") return false;

    const previousStatus = String(modal.record.status || "");
    const nextStatus = String(form.status || "");
    return previousStatus !== "CLOSED" && nextStatus === "CLOSED";
  };

  const submitCloseReason = async () => {
    const normalizedReason = closeReason.trim();
    if (!normalizedReason) {
      showToast("error", "Vui lòng nhập lý do đóng ticket");
      return;
    }

    await submitEntityForm({ closeReason: normalizedReason });
  };

  const removeRecord = async (record: Record<string, unknown>) => {
    if (!activeEntity) return;
    const confirmed = window.confirm(`Xóa bản ghi trong ${activeEntity.label}?`);
    if (!confirmed) return;

    try {
      await deleteEntity(activeEntity.key, record.__recordId);
      showToast("success", activeEntity.softDelete ? "Đã chuyển vào trạng thái xóa" : "Đã xóa bản ghi");
      await refreshAll();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Xóa thất bại");
    }
  };

  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  if (loading) return <LoadingScreen />;

  const isDashboard = isDashboardScreen(activeKey);

  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        <LeftMenu entities={entities} activeKey={activeKey} onSelect={selectEntity} />

        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
          <Header
            title={isDashboard ? "Dashboard" : activeEntity?.label || "Entities"}
            onRefresh={refreshAll}
            onCreate={isDashboard ? undefined : openCreate}
          />

          {isDashboard ? (
            <DashboardView dashboard={dashboard} />
          ) : (
            <EntityListView
              entity={activeEntity}
              list={list}
              listFields={listFields}
              search={search}
              page={page}
              loading={tableLoading}
              onSearchChange={changeSearch}
              onPageChange={setPage}
              onDetail={openDetail}
              onEdit={openEdit}
              onDelete={removeRecord}
            />
          )}
        </section>
      </div>

      {modal && activeEntity ? (
        <EntityModal
          entity={activeEntity}
          modal={modal}
          form={form}
          fields={editableFields}
          onClose={() => setModal(null)}
          onSubmit={submitForm}
          onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
        />
      ) : null}

      {closeReasonModalOpen ? (
        <CloseReasonModal
          value={closeReason}
          onChange={setCloseReason}
          onClose={() => setCloseReasonModalOpen(false)}
          onSubmit={submitCloseReason}
        />
      ) : null}

      <ToastStack toasts={toasts} />
    </main>
  );
}

function CloseReasonModal({
  value,
  onChange,
  onClose,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-4 backdrop-blur-sm">
      <section className="smooth-panel w-full max-w-lg overflow-hidden rounded-lg border border-white/10 bg-[#0b120d] shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h3 className="text-lg font-black text-white">Lý do đóng ticket</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Lý do này sẽ được gửi trực tiếp tới khách hàng qua Telegram.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/8 hover:text-white"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <label className="block text-sm font-bold text-zinc-200" htmlFor="close-ticket-reason">
            Lý do
          </label>
          <textarea
            id="close-ticket-reason"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={5}
            className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300"
            placeholder="Ví dụ: Ticket đã được xử lý và khách hàng đã xác nhận dịch vụ hoạt động bình thường."
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-white/10 px-4 text-sm font-bold text-zinc-200 transition hover:bg-white/8"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="h-10 rounded-lg bg-emerald-400 px-4 text-sm font-black text-black transition hover:bg-emerald-300"
          >
            Close ticket
          </button>
        </div>
      </section>
    </div>
  );
}

function Header({
  title,
  onRefresh,
  onCreate,
}: {
  title: string;
  onRefresh: () => void;
  onCreate?: () => void;
}) {
  return (
    <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <p className="text-sm font-medium text-emerald-300">Telegram commerce operations</p>
        <h2 className="text-2xl font-black text-white sm:text-3xl">{title}</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onRefresh}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-semibold text-zinc-100 transition hover:border-emerald-300/50 hover:bg-emerald-300/10"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
        {onCreate ? (
          <button
            onClick={onCreate}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-black text-black transition hover:bg-emerald-300"
          >
            <Plus className="h-4 w-4" />
            Create
          </button>
        ) : null}
      </div>
    </header>
  );
}
