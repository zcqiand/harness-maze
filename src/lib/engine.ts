// 竞速引擎（Task 6）：状态机 + 首输入起表 + 墙阻 + 幽灵离散驱动。
// 纯函数：时间全部注入（nowMs 参数），本模块禁 Date.now / Math.random；
// 每次变更返回新 RunState（撞墙无副作用不落步；finished 直通原样返回）。
// 分层说明：本模块只做「引擎内的墙判定」（防玩家走入非法格，越界=墙），
// 不 import walk.ts 的 assertWalkLegal——走线认证在存档层（Task 7/8）做。
// 语义（与 walk.ts 已对齐）：steps[0] 是首个落步（首输入即移动），须是自 start
// 的合法邻格；ready 态首次输入即起表（裁定 9），若首输入撞墙则起表但原地不动
// （裁定 3：撞墙 cell/steps 不变、时钟不停）。

import type { MapSpec, Cell } from "./map";
import type { Step } from "./walk";

export type Dir = "up" | "down" | "left" | "right";

export const DIR_DELTA: Record<Dir, Cell> = {
  up: { r: -1, c: 0 },
  down: { r: 1, c: 0 },
  left: { r: 0, c: -1 },
  right: { r: 0, c: 1 },
};

/** 按住连走间隔（裁定 1，builder check 授权自定值） */
export const REPEAT_MS = 140;

export type Phase = "ready" | "running" | "finished";

export interface RunState {
  phase: Phase;
  spec: MapSpec;
  cell: Cell;
  /** running 起记录，完赛含末步；ready（含首输入撞墙原地）= 空 */
  steps: Step[];
  /** 首输入起表锚（裁定 9） */
  startedAt: number | null;
  /** 最近一次注入时钟，驱动 HUD */
  nowMs: number;
  /** finished 时 = nowMs - startedAt */
  result: number | null;
}

const sameCell = (a: Cell, b: Cell): boolean => a.r === b.r && a.c === b.c;

/** 引擎内墙判定：0=通道，其余（含越界/缺行）=墙。 */
function isWall(grid: number[][], cell: Cell): boolean {
  return grid[cell.r]?.[cell.c] !== 0;
}

/** @impl M02.F01.I01 */
export function createRun(spec: MapSpec): RunState {
  return { phase: "ready", spec, cell: spec.start, steps: [], startedAt: null, nowMs: 0, result: null };
}

/**
 * ready+首输入：startedAt=nowMs 转 running；目标格合法则落首步 {t:0, cell}，
 * 撞墙则原地（steps 仍空，时钟已起——裁定 3 时钟不停）。
 * running：合法移动→落步 {t: max(nowMs-startedAt, 前步t+1), cell}（同毫秒双键钳位单调）；撞墙→cell/steps 不变（时钟不停）。
 * 到达 goal→finished，result=nowMs-startedAt，末步照落。
 * finished 后输入：原样返回（引用相等）。
 */
export function playerInput(run: RunState, dir: Dir, nowMs: number): RunState {
  if (run.phase === "finished") return run;

  const delta = DIR_DELTA[dir];
  const target: Cell = { r: run.cell.r + delta.r, c: run.cell.c + delta.c };
  const blocked = isWall(run.spec.grid, target);

  if (run.phase === "ready") {
    if (blocked) {
      // 首输入撞墙：起表但原地不落步（墙阻不判负，时钟不停）
      return { ...run, phase: "running", startedAt: nowMs, nowMs };
    }
    return {
      ...run,
      phase: "running",
      startedAt: nowMs,
      nowMs,
      cell: target,
      steps: [{ t: 0, cell: target }],
    };
  }

  // running
  if (blocked) {
    // 撞墙：cell/steps 不变，时钟不停（nowMs 照推进驱动 HUD）
    return { ...run, nowMs };
  }

  // 落步 t 单调收口（终审 F2）：nowMs 注入的时钟不保证严格递增（同毫秒双键换向真实
  // 可发生），t 相等会被 walk.ts time-inconsistent 整局误拒（玩家无作弊吃拒收）。
  // 钳到 prevT+1 保严格递增；完赛 result 同取钳后 t，认证一致性（resultTime===末步 t）保持。
  // 只用注入值，本模块仍零 Date.now；ghostCellAt「steps 严格递增可提前收」的前提由此加固。
  const prevT = run.steps.length > 0 ? run.steps[run.steps.length - 1]!.t : -1;
  const t = Math.max(nowMs - run.startedAt!, prevT + 1);
  const steps: Step[] = [...run.steps, { t, cell: target }];
  if (sameCell(target, run.spec.goal)) {
    return { ...run, phase: "finished", nowMs, cell: target, steps, result: t };
  }
  return { ...run, nowMs, cell: target, steps };
}

/**
 * 幽灵离散驱动：最近一个 t<=elapsedMs 的步位；无步/elapsed 在首步前→start；
 * 越末→末步位。离散语义，渲染插值归 UI。
 */
/** @impl M02.F02.I01 */
export function ghostCellAt(steps: readonly Step[], elapsedMs: number, start: Cell): Cell {
  let found: Cell | null = null;
  for (const s of steps) {
    if (s.t <= elapsedMs) {
      found = s.cell;
    } else {
      break; // steps 严格递增，可提前收
    }
  }
  return found ?? start;
}
