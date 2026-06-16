import { PackageOpen } from "lucide-react";

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <section className="mini-fade rounded-2xl border border-white/10 bg-white/[0.045] p-6 text-center shadow-xl shadow-black/20">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-300">
        <PackageOpen className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-black text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p>
    </section>
  );
}
