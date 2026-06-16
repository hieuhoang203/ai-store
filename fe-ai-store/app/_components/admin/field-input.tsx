import type { FieldConfig } from "@/app/_lib/admin-types";

type FieldInputProps = {
  field: FieldConfig;
  value?: string | boolean;
  onChange: (value: string | boolean) => void;
};

export function FieldInput({ field, value, onChange }: FieldInputProps) {
  const base =
    "w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300";

  if (field.type === "boolean") {
    const enabled = value === true || value === "true";

    return (
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm font-bold transition ${
          enabled
            ? "border-emerald-300 bg-emerald-300/12 text-emerald-200"
            : "border-white/10 bg-black/35 text-zinc-300"
        }`}
      >
        <span>{enabled ? "Enabled" : "Disabled"}</span>
        <span className={`h-5 w-9 rounded-full p-0.5 transition ${enabled ? "bg-emerald-400" : "bg-zinc-700"}`}>
          <span className={`block h-4 w-4 rounded-full bg-black transition ${enabled ? "translate-x-4" : ""}`} />
        </span>
      </button>
    );
  }

  if (field.type === "enum") {
    return (
      <select
        className={base}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
      >
        <option value="">Select...</option>
        {field.options?.map((option) => (
          <option key={`${option.label}-${option.value}`} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "text" || field.type === "json") {
    return (
      <textarea
        className={`${base} min-h-28 resize-y`}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        placeholder={field.type === "json" ? "{\"key\":\"value\"}" : ""}
      />
    );
  }

  return (
    <input
      className={base}
      value={String(value ?? "")}
      onChange={(event) => onChange(event.target.value)}
      required={field.required}
      type={field.type === "date" ? "datetime-local" : field.type === "int" || field.type === "decimal" ? "number" : "text"}
      step={field.type === "decimal" ? "0.01" : undefined}
    />
  );
}
