import type { FieldConfig, FormValues } from "./admin-types";

export const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function formatNumber(value: string | number) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

export function renderValue(field: FieldConfig, value: unknown) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-zinc-600">-</span>;
  }

  if (field.type === "boolean") {
    return (
      <span
        className={`rounded-full px-2 py-1 text-xs font-bold ${
          value ? "bg-emerald-400/15 text-emerald-200" : "bg-zinc-700/50 text-zinc-300"
        }`}
      >
        {value ? "Yes" : "No"}
      </span>
    );
  }

  if (field.type === "enum" || field.type === "relation") {
    const option = field.options?.find((item) => String(item.value) === String(value));

    return (
      <span className="rounded-full bg-emerald-400/12 px-2 py-1 text-xs font-bold text-emerald-200">
        {option?.label || String(value)}
      </span>
    );
  }

  if (field.type === "date") return new Date(String(value)).toLocaleString("vi-VN");
  if (field.type === "json") return JSON.stringify(value);
  return String(value);
}

export function toFormValues(record: Record<string, unknown>) {
  const values: FormValues = {};

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "boolean") values[key] = value;
    else if (value instanceof Date) values[key] = toDateInput(value.toISOString());
    else if (typeof value === "object" && value !== null) {
      values[key] = JSON.stringify(value, null, 2);
    } else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      values[key] = toDateInput(value);
    } else if (value !== null && value !== undefined) {
      values[key] = String(value);
    }
  }

  return values;
}

export function buildPayload(fields: FieldConfig[], form: FormValues) {
  const payload: Record<string, string | boolean | null> = {};

  for (const field of fields) {
    const value = form[field.name];
    payload[field.name] = value === undefined || value === "" ? null : value;
  }

  return payload;
}

function toDateInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
