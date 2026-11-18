// 完赛面板（Task 8，纯渲染）：完赛时间 + 与 PB 差值（±s.ms；无 PB=「首个幽灵已认证入档」）
// + 破 PB 高亮（瞬时高亮文案「新幽灵上位」）+ 重赛/回选图按钮。
// pb=本局开跑前的在位幽灵（差值对它算）；beatPb=破 PB（认证入档成功且上位）由 App 判定注入。

import type { JSX } from "react";
import type { GhostRecord } from "../lib/ghosts";
import { formatMs } from "./GhostPanel";

export function FinishPanel(props: {
  result: number;
  pb: GhostRecord | null;
  beatPb: boolean;
  onRetry: () => void;
  onBack: () => void;
}): JSX.Element {
  const { result, pb, beatPb, onRetry, onBack } = props;

  const diff = pb !== null ? result - pb.result.time : null;
  const diffText =
    diff === null
      ? null
      : `${diff >= 0 ? "+" : "-"}${formatMs(Math.abs(diff))}`;

  return (
    <section className="rounded-lg border border-white/10 bg-neutral-900/80 px-4 py-3">
      <div className="flex items-baseline gap-3">
        <span className="rounded bg-emerald-900/60 px-2 py-0.5 text-xs text-emerald-300">
          完赛
        </span>
        <span className="font-mono text-3xl font-bold tabular-nums text-white">
          {formatMs(result)}
        </span>
      </div>

      {pb === null ? (
        <p className="mt-2 text-sm text-emerald-300">首个幽灵已认证入档</p>
      ) : (
        <p className="mt-2 text-sm text-neutral-400">
          对比最佳 <span className="font-mono text-neutral-200">{diffText}</span>
          {beatPb && (
            <span className="ml-2 animate-pulse rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300">
              新幽灵上位
            </span>
          )}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          data-fn="finish-retry"
          className="rounded border border-white/20 bg-neutral-800 px-3 py-1 text-sm text-white hover:border-white/60"
        >
          重赛
        </button>
        <button
          type="button"
          onClick={onBack}
          data-fn="finish-back"
          className="rounded border border-white/20 bg-neutral-800 px-3 py-1 text-sm text-white hover:border-white/60"
        >
          回选图
        </button>
      </div>
    </section>
  );
}
