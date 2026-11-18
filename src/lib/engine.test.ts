// 竞速引擎测试（Task 6）：首输入起表 + 连走计时 + 撞墙不判负 + 完赛 + finished 直通 + 幽灵离散驱动。
// 5×5 走廊 spec 自构（walk.test.ts 同款 grid）：全 1 起步，挖
// (1,1)-(1,2)-(1,3)-(2,3)-(3,3)-(3,2)-(3,1) 通道；start=(1,1)，goal 用走廊尽头 (3,1)。
// 时间全部注入（nowMs），引擎内无 Date.now / Math.random。

import { describe, it, expect } from "vitest";
import type { MapSpec, Cell } from "./map";
import { validateMapSpec } from "./map";
import { createRun, playerInput, ghostCellAt, DIR_DELTA, REPEAT_MS } from "./engine";
import type { Step } from "./walk";

const GRID: number[][] = [
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1],
];

const SPEC: MapSpec = { name: "corridor", grid: GRID, start: { r: 1, c: 1 }, goal: { r: 3, c: 1 } };

const cell = (r: number, c: number): Cell => ({ r, c });
const step = (t: number, r: number, c: number): Step => ({ t, cell: cell(r, c) });

describe("createRun", () => {
  it("初始态：ready / cell=start / 空 steps / startedAt=null / nowMs=0 / result=null", () => {
    expect(validateMapSpec(SPEC)).toBeNull(); // 护栏：样本本身合法
    const run = createRun(SPEC);
    expect(run.phase).toBe("ready");
    expect(run.cell).toEqual({ r: 1, c: 1 });
    expect(run.steps).toEqual([]);
    expect(run.startedAt).toBeNull();
    expect(run.nowMs).toBe(0);
    expect(run.result).toBeNull();
    expect(run.spec).toBe(SPEC);
  });
});

describe("DIR_DELTA / REPEAT_MS", () => {
  it("四向增量：up={-1,0} down={1,0} left={0,-1} right={0,1}；REPEAT_MS=140", () => {
    expect(DIR_DELTA.up).toEqual({ r: -1, c: 0 });
    expect(DIR_DELTA.down).toEqual({ r: 1, c: 0 });
    expect(DIR_DELTA.left).toEqual({ r: 0, c: -1 });
    expect(DIR_DELTA.right).toEqual({ r: 0, c: 1 });
    expect(REPEAT_MS).toBe(140);
  });
});

describe("playerInput", () => {
  it("②首输入起表：ready 态输入 right@1000 → running、startedAt=1000、首步 {t:0,(1,2)}", () => {
    const run = playerInput(createRun(SPEC), "right", 1000);
    expect(run.phase).toBe("running");
    expect(run.startedAt).toBe(1000);
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0]).toEqual({ t: 0, cell: { r: 1, c: 2 } });
    expect(run.cell).toEqual({ r: 1, c: 2 });
    expect(run.nowMs).toBe(1000);
    expect(run.result).toBeNull();
  });

  it("③连走计时：right@1400 → 第二步 {t:400,(1,3)}，仍 running", () => {
    let run = playerInput(createRun(SPEC), "right", 1000);
    run = playerInput(run, "right", 1400);
    expect(run.phase).toBe("running");
    expect(run.steps).toEqual([
      { t: 0, cell: { r: 1, c: 2 } },
      { t: 400, cell: { r: 1, c: 3 } },
    ]);
    expect(run.cell).toEqual({ r: 1, c: 3 });
  });

  it("④撞墙=阻挡不判负：running 态朝墙输入 → cell/steps 不变、phase 仍 running、时钟不停", () => {
    let run = playerInput(createRun(SPEC), "right", 1000);
    run = playerInput(run, "right", 1400); // 现位于 (1,3)，up 是墙
    const before = run;
    run = playerInput(run, "up", 1800);
    expect(run.phase).toBe("running");
    expect(run.cell).toEqual(before.cell);
    expect(run.steps).toBe(before.steps); // 无副作用不落步（引用相等）
    expect(run.startedAt).toBe(1000);
    expect(run.nowMs).toBe(1800); // 时钟仍被推进注入
  });

  it("ready 态朝墙首输入同样只起表不落步？——首步若非法（撞墙）则 clock 起但原地不动", () => {
    // 首输入即撞墙：起表语义仍是「起表」，但落不了合法首步 → cell/steps 不动。
    // 本仓裁定：首步必须自 start 的合法邻格（与 walk.ts not-from-start 对齐）；
    // 撞墙首输入 = 起表 + 原地（phase=running、startedAt 已定、steps 仍空）。
    const run = playerInput(createRun(SPEC), "up", 1000); // (1,1) 上方 (0,1) 是墙
    expect(run.phase).toBe("running");
    expect(run.startedAt).toBe(1000);
    expect(run.steps).toEqual([]);
    expect(run.cell).toEqual({ r: 1, c: 1 });
  });

  it("⑤完赛：六步走到 goal(3,1) → finished、result=nowMs-startedAt、末步照落 cell=goal", () => {
    let run = createRun(SPEC);
    run = playerInput(run, "right", 1000); // (1,2) t=0
    run = playerInput(run, "right", 1400); // (1,3) t=400
    run = playerInput(run, "down", 1800); // (2,3) t=800
    run = playerInput(run, "down", 2200); // (3,3) t=1200
    run = playerInput(run, "left", 2600); // (3,2) t=1600
    expect(run.phase).toBe("running");
    run = playerInput(run, "left", 3000); // (3,1) = goal，t=2000
    expect(run.phase).toBe("finished");
    expect(run.result).toBe(2000); // 3000 - 1000
    expect(run.steps).toHaveLength(6);
    const last = run.steps[run.steps.length - 1];
    expect(last).toEqual({ t: 2000, cell: { r: 3, c: 1 } });
    expect(last?.cell).toEqual(SPEC.goal);
  });

  it("⑥finished 后输入原样返回（引用相等）", () => {
    let run = createRun(SPEC);
    run = playerInput(run, "right", 1000);
    run = playerInput(run, "right", 1400);
    run = playerInput(run, "down", 1800);
    run = playerInput(run, "down", 2200);
    run = playerInput(run, "left", 2600);
    run = playerInput(run, "left", 3000);
    expect(run.phase).toBe("finished");
    expect(playerInput(run, "up", 9999)).toBe(run);
    expect(playerInput(run, "right", 9999)).toBe(run);
  });
});

describe("ghostCellAt", () => {
  const start: Cell = { r: 1, c: 1 };
  const steps: Step[] = [step(520, 1, 2), step(1040, 1, 3)];

  it("elapsed 在首步前 → start", () => {
    expect(ghostCellAt(steps, 0, start)).toEqual(start);
    expect(ghostCellAt(steps, 519, start)).toEqual(start);
  });

  it("elapsed 在两步之间 → 前一步位", () => {
    expect(ghostCellAt(steps, 520, start)).toEqual({ r: 1, c: 2 });
    expect(ghostCellAt(steps, 700, start)).toEqual({ r: 1, c: 2 });
  });

  it("越末 → 末步位", () => {
    expect(ghostCellAt(steps, 1040, start)).toEqual({ r: 1, c: 3 });
    expect(ghostCellAt(steps, 99999, start)).toEqual({ r: 1, c: 3 });
  });

  it("空 steps → start", () => {
    expect(ghostCellAt([], 12345, start)).toEqual(start);
  });
});
