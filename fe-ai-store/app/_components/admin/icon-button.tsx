export function IconButton({
  title,
  danger,
  children,
  onClick,
}: {
  title: string;
  danger?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
        danger
          ? "border-red-400/20 text-red-300 hover:bg-red-400/10"
          : "border-white/10 text-zinc-300 hover:border-emerald-300/50 hover:bg-emerald-300/10 hover:text-emerald-200"
      }`}
    >
      {children}
    </button>
  );
}
