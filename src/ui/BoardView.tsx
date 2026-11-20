// 棋盘渲染（Task 8，纯渲染）：墙=深色块 / 通道=沥青底+白线网格，
// start/goal 标记，玩家块高亮，幽灵半透明轮廓叠层。 @impl M05.F01.I01
// 不接时钟——位置全部由 props 给定；引擎离散步的渲染连续化靠 CSS transition：
// 幽灵位移时长=REPEAT_MS（近似按住连走节拍），玩家位移更短更跟手。

import type { JSX, CSSProperties } from "react";
import type { MapSpec, Cell } from "../lib/map";
import { REPEAT_MS } from "../lib/engine";

const PLAYER_TRANSITION_MS = 90;

function tokenStyle(cell: Cell, size: number, transitionMs: number): CSSProperties {
  const pct = 100 / size;
  return {
    left: `${cell.c * pct}%`,
    top: `${cell.r * pct}%`,
    width: `${pct}%`,
    height: `${pct}%`,
    transition: `left ${transitionMs}ms linear, top ${transitionMs}ms linear`,
  };
}

export function BoardView(props: {
  spec: MapSpec;
  player: Cell;
  ghost: Cell | null;
}): JSX.Element {
  const { spec, player, ghost } = props;
  const size = spec.grid.length;

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-md select-none overflow-hidden rounded-lg border-2 border-white/15 bg-neutral-950"
      role="img"
      aria-label={`迷宫 ${spec.name}`}
    >
      {/* 底盘：墙=深色块，通道=沥青底+白线网格 */}
      <div
        className="grid h-full w-full"
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      >
        {spec.grid.map((row, r) =>
          row.map((v, c) => {
            const isStart = spec.start.r === r && spec.start.c === c;
            const isGoal = spec.goal.r === r && spec.goal.c === c;
            return v !== 0 ? (
              <div key={`${r}-${c}`} className="bg-neutral-950" />
            ) : (
              <div
                key={`${r}-${c}`}
                className="bg-neutral-800 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
              >
                {isStart && (
                  <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-emerald-400 sm:text-xs">
                    S
                  </span>
                )}
                {isGoal && (
                  <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-amber-400 sm:text-xs">
                    G
                  </span>
                )}
              </div>
            );
          }),
        )}
      </div>

      {/* 幽灵半透明轮廓叠层（裁定 3：不阻挡不交互，纯视觉） */}
      {ghost !== null && (
        <div
          className="absolute rounded-sm border-2 border-emerald-300/60 bg-emerald-400/15"
          style={tokenStyle(ghost, size, REPEAT_MS)}
          data-ghost="true"
        />
      )}

      {/* 玩家块高亮 */}
      <div
        className="absolute rounded-sm bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
        style={tokenStyle(player, size, PLAYER_TRANSITION_MS)}
      />
    </div>
  );
}
