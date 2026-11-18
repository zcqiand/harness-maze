// 计时 HUD（Task 8，纯渲染）：ready=0.000 待出发；running=nowMs-startedAt（App 的
// rAF 把 nowMs 注入 RunState，本组件只读）；finished=完赛时间。

import type { JSX } from "react";
import type { RunState } from "../lib/engine";
import { formatMs } from "./GhostPanel";

export function Hud(props: { run: RunState }): JSX.Element {
  const { run } = props;
  const ms =
    run.startedAt === null ? 0 : (run.result ?? run.nowMs - run.startedAt);

  const phaseLabel =
    run.phase === "ready" ? "待出发" : run.phase === "running" ? "计时中" : "完赛";
  const phaseClass =
    run.phase === "finished"
      ? "bg-emerald-900/60 text-emerald-300"
      : run.phase === "running"
        ? "bg-amber-900/60 text-amber-300"
        : "bg-neutral-800 text-neutral-400";

  return (
    <div className="flex items-baseline gap-3">
      <span className={`rounded px-2 py-0.5 text-xs ${phaseClass}`}>
        {run.phase === "running" && (
          <span className="rec-blink mr-1 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />
        )}
        {phaseLabel}
      </span>
      <span className="font-mono text-3xl font-bold tabular-nums text-white">
        {formatMs(ms)}
      </span>
      <span className="text-xs text-neutral-500">{run.steps.length} 步</span>
    </div>
  );
}
