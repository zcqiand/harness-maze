// 选图屏（纯渲染）：5 张图卡片 = 名称 + 尺寸 + 最佳时间 + 幽灵在位标记。
// sealed 卡片标「旧版」并禁点（裁定 10：不可赛不可记档）；其余可点，经 onSelect 回调出。
// 视图模型由 App 计算（generatePack + compareGhost 注入），组件不碰 storage / generator。

import type { JSX } from "react";
import { formatMs } from "./GhostPanel";

export interface MazeCardVM {
  mapIndex: number;
  name: string;
  size: number; // grid 边长（正方形）
  bestMs: number | null; // 在位幽灵或封存成绩的最佳时间
  ghostInPlace: boolean;
  sealed: boolean;
}

export function MazeSelect(props: {
  mazes: MazeCardVM[];
  onSelect: (mapIndex: number) => void;
}): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {props.mazes.map((m) =>
        m.sealed ? (
          <button
            key={m.mapIndex}
            type="button"
            disabled
            aria-disabled="true"
            className="cursor-not-allowed rounded-lg border-2 border-white/10 bg-neutral-900/50 px-4 py-3 text-left opacity-60"
          >
            <span className="block font-mono text-lg text-neutral-300">{m.name}</span>
            <span className="mt-1 block text-xs text-neutral-500">
              {m.size}×{m.size} · 最佳 {m.bestMs !== null ? formatMs(m.bestMs) : "—"}
            </span>
            <span className="mt-2 inline-block rounded bg-neutral-700 px-2 py-0.5 text-xs text-neutral-300">
              旧版
            </span>
          </button>
        ) : (
          <button
            key={m.mapIndex}
            type="button"
            onClick={() => props.onSelect(m.mapIndex)}
            className="rounded-lg border-2 border-white/15 bg-neutral-900 px-4 py-3 text-left text-white transition-colors hover:border-white/60 hover:bg-neutral-800"
          >
            <span className="block font-mono text-lg">{m.name}</span>
            <span className="mt-1 block text-xs text-neutral-500">
              {m.size}×{m.size} · 最佳 {m.bestMs !== null ? formatMs(m.bestMs) : "—"}
            </span>
            {m.ghostInPlace && (
              <span className="mt-2 inline-block rounded bg-emerald-900/60 px-2 py-0.5 text-xs text-emerald-300">
                幽灵在位
              </span>
            )}
          </button>
        ),
      )}
    </div>
  );
}
