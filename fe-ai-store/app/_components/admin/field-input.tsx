import { ImageUp, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { uploadAdminImage } from "@/app/_lib/admin-api";
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

  if (field.type === "enum" || field.type === "relation") {
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

  if (field.type === "image") {
    return <ImageInput value={String(value ?? "")} onChange={(nextValue) => onChange(nextValue)} />;
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

function ImageInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(file?: File) {
    if (!file) return;

    setUploading(true);
    setError("");
    try {
      const result = await uploadAdminImage(file);
      onChange(result.url);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Upload image failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      {value ? (
        <div className="overflow-hidden rounded-lg border border-white/10 bg-black/35">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-44 w-full object-cover" />
          <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 truncate text-xs font-medium text-emerald-200 hover:text-emerald-100"
            >
              {value}
            </a>
            <button
              type="button"
              onClick={() => onChange("")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/8 hover:text-white"
              title="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/35 px-3 text-sm font-bold text-zinc-100 transition hover:border-emerald-300/50 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
        {uploading ? "Uploading..." : value ? "Replace image" : "Upload image"}
      </button>

      {error ? <p className="text-xs font-semibold text-red-300">{error}</p> : null}
    </div>
  );
}
