// 成绩册面板（纯渲染）：ghost 在位 → 最佳时间 + 「幽灵在位」；sealed → 「旧版封存」
//（裁定 10：旧版成绩册可见、不可赛不可记档）；双空 → 「暂无幽灵」。
// formatMs 导出供 Task 8 HUD 复用（秒.三位毫秒，如 12.340）。

import type { JSX } from "react";
import type { GhostRecord } from "../lib/ghosts";

/** ms → `秒.三位毫秒`（12340 → "12.340"；负值按 0 收口） */
export function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms));
  const sec = Math.floor(total / 1000);
  const frac = String(total % 1000).padStart(3, "0");
  return `${sec}.${frac}`;
}

export function GhostPanel(props: {
  ghost: GhostRecord | null;
  sealed: GhostRecord | null;
}): JSX.Element {
  const { ghost, sealed } = props;

  if (ghost === null && sealed === null) {
    return (
      <section className="rounded-lg border border-white/10 bg-neutral-900/80 px-4 py-3 text-neutral-400">
        暂无幽灵
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-white/10 bg-neutral-900/80 px-4 py-3">
      <h3 className="text-xs font-semibold tracking-widest text-neutral-400 uppercase">成绩册</h3>
      {ghost !== null && (
        <div className="mt-2 flex items-baseline gap-3">
          <span className="rounded bg-emerald-900/60 px-2 py-0.5 text-xs text-emerald-300">
            幽灵在位
          </span>
          <span className="font-mono text-2xl text-white">{formatMs(ghost.result.time)}</span>
          <span className="text-xs text-neutral-500">最佳时间</span>
        </div>
      )}
      {sealed !== null && (
        <div className="mt-2 flex items-baseline gap-3">
          <span className="rounded bg-neutral-700 px-2 py-0.5 text-xs text-neutral-300">
            旧版封存
          </span>
          <span className="font-mono text-lg text-neutral-400 line-through">
            {formatMs(sealed.result.time)}
          </span>
          <span className="text-xs text-neutral-500">旧版成绩，不可赛不可记档</span>
        </div>
      )}
    </section>
  );
}
