// 走线认证判定器测试（Task 4，round 1 修订）
// 走线语义（controller 裁定，修计划缺陷）：steps[0] 是首个落步（首输入即移动）——
// 须是自 start 的合法首步：与 start 曼哈顿距离 1 且该格非墙（越界=墙）；末项必须是 goal。
// 5×5 走廊 spec 自构：全 1 起步，挖 (1,1)-(1,2)-(1,3)-(2,3)-(3,3)-(3,2)-(3,1) 通道。
// 两步合法走线（首格=start 邻格、末格=goal）用 goal=(1,3) 变体；走廊尽头违规样本用 goal(3,1)。

import { describe, it, expect } from "vitest";
import type { MapSpec, Cell } from "./map";
import { validateMapSpec } from "./map";
import { assertWalkLegal, WalkViolationError } from "./walk";
import type { Step } from "./walk";

const GRID: number[][] = [
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1],
];

const START: Cell = { r: 1, c: 1 };

/** goal(1,3)：距 start 两步，两步合法走线样本用 */
const SPEC_NEAR: MapSpec = { name: "corridor-near", grid: GRID, start: START, goal: { r: 1, c: 3 } };
/** goal(3,1)：走廊尽头，裁定 grid 原样 */
const SPEC_FAR: MapSpec = { name: "corridor-far", grid: GRID, start: START, goal: { r: 3, c: 1 } };

const cell = (r: number, c: number): Cell => ({ r, c });
const step = (t: number, r: number, c: number): Step => ({ t, cell: cell(r, c) });

function expectViolation(
  spec: MapSpec,
  steps: readonly Step[],
  resultTime: number,
  reason: string,
  stepIndex: number,
): void {
  expect(() => assertWalkLegal(spec, steps, resultTime)).toThrow(WalkViolationError);
  try {
    assertWalkLegal(spec, steps, resultTime);
  } catch (e) {
    const err = e as WalkViolationError;
    expect(err).toBeInstanceOf(WalkViolationError);
    expect(err.reason).toBe(reason);
    expect(err.stepIndex).toBe(stepIndex);
  }
}

describe("assertWalkLegal", () => {
  it("spec 样本本身合法（护栏）", () => {
    expect(validateMapSpec(SPEC_NEAR)).toBeNull();
    expect(validateMapSpec(SPEC_FAR)).toBeNull();
  });

  it("合法走线（两步，t=520/1040，resultTime=1040）不抛", () => {
    const steps = [step(520, 1, 2), step(1040, 1, 3)];
    expect(() => assertWalkLegal(SPEC_NEAR, steps, 1040)).not.toThrow();
  });

  it("空 steps → empty stepIndex=-1", () => {
    expectViolation(SPEC_FAR, [], 0, "empty", -1);
  });

  it("首格不是自 start 的合法首步（距 start 2 格）→ not-from-start stepIndex=0", () => {
    const steps = [step(520, 1, 3), step(1040, 1, 2)];
    expectViolation(SPEC_NEAR, steps, 1040, "not-from-start", 0);
  });

  it("首格踩墙（距 start 相邻但是墙）→ not-from-start stepIndex=0", () => {
    const steps = [step(520, 2, 1), step(1040, 1, 2)];
    expectViolation(SPEC_NEAR, steps, 1040, "not-from-start", 0);
  });

  it("末格≠goal → not-to-goal stepIndex=末步号", () => {
    // 同一条两步走线，goal=(3,1) 时末格 (1,3) ≠ goal
    const steps = [step(520, 1, 2), step(1040, 1, 3)];
    expectViolation(SPEC_FAR, steps, 1040, "not-to-goal", 1);
  });

  it("相邻步跨 2 格（斜跳）→ step-not-adjacent stepIndex=1", () => {
    // (1,2)→(2,3) 曼哈顿距离 2，两格均非墙；末格仍是 goal(3,1)
    const steps = [
      step(520, 1, 2),
      step(1040, 2, 3),
      step(1560, 3, 3),
      step(2080, 3, 2),
      step(2600, 3, 1),
    ];
    expectViolation(SPEC_FAR, steps, 2600, "step-not-adjacent", 1);
  });

  it("目标格是墙 → into-wall stepIndex=1", () => {
    // (1,2)→(2,2) 相邻但 (2,2) 是墙；末格 goal(3,1)
    const steps = [
      step(520, 1, 2),
      step(1040, 2, 2),
      step(1560, 2, 3),
      step(2080, 3, 3),
      step(2600, 3, 2),
      step(3120, 3, 1),
    ];
    expectViolation(SPEC_FAR, steps, 3120, "into-wall", 1);
  });

  it("steps 含越界格（r 越下界）→ into-wall 而非 TypeError，stepIndex=1", () => {
    const steps = [
      step(520, 1, 2),
      step(1040, -1, 1),
      step(1560, 2, 3),
      step(2080, 3, 3),
      step(2600, 3, 2),
      step(3120, 3, 1),
    ];
    expectViolation(SPEC_FAR, steps, 3120, "into-wall", 1);
  });

  it("steps 含越界格（r 越上界）→ into-wall stepIndex=1", () => {
    const steps = [
      step(520, 1, 2),
      step(1040, 5, 2),
      step(1560, 2, 3),
      step(2080, 3, 3),
      step(2600, 3, 2),
      step(3120, 3, 1),
    ];
    expectViolation(SPEC_FAR, steps, 3120, "into-wall", 1);
  });

  it("resultTime ≠ 末步 t → time-inconsistent stepIndex=末步号", () => {
    const steps = [step(520, 1, 2), step(1040, 1, 3)];
    expectViolation(SPEC_NEAR, steps, 999, "time-inconsistent", 1);
  });

  it("t 回退（第二步 t 小于第一步）→ time-inconsistent stepIndex=1", () => {
    const steps = [step(520, 1, 2), step(260, 1, 3)];
    expectViolation(SPEC_NEAR, steps, 260, "time-inconsistent", 1);
  });

  it("负 t → time-inconsistent stepIndex=0", () => {
    const steps = [step(-100, 1, 2), step(1040, 1, 3)];
    expectViolation(SPEC_NEAR, steps, 1040, "time-inconsistent", 0);
  });
});
