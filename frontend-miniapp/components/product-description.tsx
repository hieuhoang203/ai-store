"use client";

import { useState } from "react";

export function ProductDescription({ description }: { description?: string | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!description) return null;

  return (
    <div className="mt-3">
      <p
        className="overflow-hidden text-sm leading-6 text-zinc-400"
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 4,
              }
        }
      >
        {description}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mt-1 h-7 rounded-md text-sm font-bold text-emerald-300 transition hover:text-emerald-200"
      >
        {expanded ? "Thu gọn" : "Đọc thêm"}
      </button>
    </div>
  );
}
