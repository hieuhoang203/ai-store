import { X } from "lucide-react";
import type { FormEvent } from "react";
import type { EntityConfig, FieldConfig, FormValues, ModalState } from "@/app/_lib/admin-types";
import { renderValue } from "@/app/_lib/admin-format";
import { FieldInput } from "./field-input";

type EntityModalProps = {
  entity: EntityConfig;
  modal: ModalState;
  form: FormValues;
  fields: FieldConfig[];
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  onChange: (name: string, value: string | boolean) => void;
};

export function EntityModal({
  entity,
  modal,
  form,
  fields,
  onClose,
  onSubmit,
  onChange,
}: EntityModalProps) {
  if (!modal) return null;

  const isDetail = modal.type === "detail";
  const title =
    modal.type === "create"
      ? `Create ${entity.label}`
      : modal.type === "edit"
        ? `Update ${entity.label}`
        : `${entity.label} detail`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="smooth-panel max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg border border-white/10 bg-[#0b120d] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-lg font-black text-white">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/8 hover:text-white"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isDetail ? (
          <DetailView entity={entity} record={modal.record} />
        ) : (
          <form onSubmit={onSubmit}>
            <div className="grid max-h-[70vh] gap-4 overflow-auto p-5 md:grid-cols-2">
              {fields.map((field) => (
                <label
                  key={field.name}
                  className={field.type === "text" || field.type === "json" ? "md:col-span-2" : ""}
                >
                  <span className="mb-2 block text-sm font-bold text-zinc-200">
                    {field.label}
                    {field.required ? <span className="text-emerald-300"> *</span> : null}
                  </span>
                  <FieldInput
                    field={field}
                    value={form[field.name]}
                    onChange={(value) => onChange(field.name, value)}
                  />
                </label>
              ))}
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
                type="submit"
                className="h-10 rounded-lg bg-emerald-400 px-4 text-sm font-black text-black transition hover:bg-emerald-300"
              >
                Save
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function DetailView({
  entity,
  record,
}: {
  entity: EntityConfig;
  record: Record<string, unknown>;
}) {
  return (
    <div className="max-h-[70vh] overflow-auto p-5">
      <dl className="grid gap-3 md:grid-cols-2">
        {entity.fields
          .filter((field) => !field.hidden)
          .map((field) => (
            <div key={field.name} className="rounded-lg border border-white/10 bg-black/28 p-3">
              <dt className="mb-1 text-xs font-bold uppercase text-zinc-500">{field.label}</dt>
              <dd className="break-words text-sm text-zinc-100">{renderValue(field, record[field.name])}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
