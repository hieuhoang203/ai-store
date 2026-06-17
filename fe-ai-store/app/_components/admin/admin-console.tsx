"use client";

import { Plus, RefreshCw } from "lucide-react";
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
    setModal({ type: "create" });
  };

  const openEdit = async (record: Record<string, unknown>) => {
    try {
      if (!activeEntity) return;
      const fullRecord = await getEntityDetail(activeEntity.key, record.__recordId);
      setForm(toFormValues(fullRecord));
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

    try {
      const payload = buildPayload(editableFields, form);

      if (modal.type === "create") {
        await createEntity(activeEntity.key, payload);
        showToast("success", "Tạo bản ghi thành công");
      } else {
        await updateEntity(activeEntity.key, modal.record.__recordId, payload);
        showToast("success", "Cập nhật bản ghi thành công");
      }

      setModal(null);
      await refreshAll();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Thao tác thất bại");
    }
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

      <ToastStack toasts={toasts} />
    </main>
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
