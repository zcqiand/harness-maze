// 走线认证判定器（Task 4，round 1 修订）：合法性断言，违规步号入错。
// 走线语义（controller 裁定）：steps[0] 是首个落步（首输入即移动）——须是自 start 的
// 合法首步：与 start 曼哈顿距离 1 且该格非墙；其后逐格，末项必须是 goal。
// 短路顺序：empty → 首步合法（越界先归 into-wall）→ 末格=goal → 逐步（相邻/非墙/时间）
// → resultTime===末步 t。
// time-inconsistent 三态：负 t / t 非严格递增（步号=违规步）/ resultTime≠末步 t（步号=末步号）。
// 越界（r/c 负、≥行数/列数、NaN）归 into-wall，reason 不新增枚举。

import type { MapSpec, Cell } from "./map";

export interface Step {
  /** 本步相对开局毫秒，须严格递增且 ≥0 */
  t: number;
  cell: Cell;
}

export type WalkViolationReason =
  | "empty"
  | "not-from-start"
  | "not-to-goal"
  | "step-not-adjacent"
  | "into-wall"
  | "time-inconsistent";

export class WalkViolationError extends Error {
  /** 违规步号（0 起；empty=-1；not-to-goal 与 resultTime 不匹配=末步号） */
  readonly stepIndex: number;
  readonly reason: WalkViolationReason;

  constructor(stepIndex: number, reason: WalkViolationReason) {
    super(`walk violation at step ${stepIndex}: ${reason}`);
    this.name = "WalkViolationError";
    this.stepIndex = stepIndex;
    this.reason = reason;
  }
}

const manhattan = (a: Cell, b: Cell): number => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);

const sameCell = (a: Cell, b: Cell): boolean => a.r === b.r && a.c === b.c;

/** 越界（含 NaN——NaN 与任何数比较均 false）= 墙。 */
function outOfBounds(grid: number[][], cell: Cell): boolean {
  return !(cell.r >= 0 && cell.r < grid.length && cell.c >= 0 && cell.c < grid[cell.r]!.length);
}

/** 合法返回静默通过；违规抛 WalkViolationError（message 带步号与 reason）。 @impl M02.F03.I01 */
export function assertWalkLegal(spec: MapSpec, steps: readonly Step[], resultTime: number): void {
  if (steps.length === 0) {
    throw new WalkViolationError(-1, "empty");
  }

  // 首步：越界先归 into-wall；再断言自 start 的合法首步（相邻 + 非墙）
  const first = steps[0]!;
  if (outOfBounds(spec.grid, first.cell)) {
    throw new WalkViolationError(0, "into-wall");
  }
  if (manhattan(spec.start, first.cell) !== 1 || spec.grid[first.cell.r]![first.cell.c] !== 0) {
    throw new WalkViolationError(0, "not-from-start");
  }
  if (!(first.t >= 0)) {
    throw new WalkViolationError(0, "time-inconsistent");
  }
  let prevT = first.t;
  let prevCell = first.cell;

  const lastIndex = steps.length - 1;
  if (!sameCell(steps[lastIndex]!.cell, spec.goal)) {
    throw new WalkViolationError(lastIndex, "not-to-goal");
  }

  for (let i = 1; i < steps.length; i++) {
    const { t, cell } = steps[i]!;
    // 边界检查先于相邻检查（裁定：逐步检查前先做边界检查，越界归 into-wall）
    if (outOfBounds(spec.grid, cell)) {
      throw new WalkViolationError(i, "into-wall");
    }
    if (manhattan(prevCell, cell) !== 1) {
      throw new WalkViolationError(i, "step-not-adjacent");
    }
    if (spec.grid[cell.r]![cell.c] !== 0) {
      throw new WalkViolationError(i, "into-wall");
    }
    if (!(t >= 0) || t <= prevT) {
      throw new WalkViolationError(i, "time-inconsistent");
    }
    prevT = t;
    prevCell = cell;
  }

  if (resultTime !== prevT) {
    throw new WalkViolationError(lastIndex, "time-inconsistent");
  }
}
