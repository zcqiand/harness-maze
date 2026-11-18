import { describe, it, expect } from "vitest";
import {
  validateMapSpec,
  gridHash,
  bfsSolvable,
  type MapSpec,
} from "./map";
import level001 from "../../data/levels/level_001.json";

// level_001 内容内联构造（Task 2 Step 1 规约样例）
const level001Grid: number[][] = [
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1],
];

const legalSpec: MapSpec = {
  name: "sample-corridor",
  grid: level001Grid,
  start: { r: 1, c: 1 },
  goal: { r: 3, c: 3 },
};

describe("validateMapSpec", () => {
  it("合法 spec 返回 null", () => {
    expect(validateMapSpec(legalSpec)).toBeNull();
  });

  it("grid-empty：空 grid", () => {
    const spec: MapSpec = { ...legalSpec, grid: [] };
    expect(validateMapSpec(spec)).toBe("grid-empty");
  });

  it("grid-ragged：行不等长", () => {
    const spec: MapSpec = {
      ...legalSpec,
      grid: [
        [1, 1, 1, 1, 1],
        [1, 0, 0, 0],
        [1, 1, 1, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 1, 1, 1, 1],
      ],
    };
    expect(validateMapSpec(spec)).toBe("grid-ragged");
  });

  it("bad-cell-value：含 2", () => {
    const grid = level001Grid.map((row) => [...row]);
    grid[1][1] = 2;
    const spec: MapSpec = { ...legalSpec, grid };
    expect(validateMapSpec(spec)).toBe("bad-cell-value");
  });

  it("no-border-wall：边界开口", () => {
    const grid = level001Grid.map((row) => [...row]);
    grid[0][2] = 0; // 顶边开口
    const spec: MapSpec = { ...legalSpec, grid };
    expect(validateMapSpec(spec)).toBe("no-border-wall");
  });

  it("start-on-wall：start 落墙", () => {
    const spec: MapSpec = { ...legalSpec, start: { r: 0, c: 0 } };
    expect(validateMapSpec(spec)).toBe("start-on-wall");
  });

  it("goal-on-wall：goal 落墙", () => {
    const spec: MapSpec = { ...legalSpec, goal: { r: 4, c: 4 } };
    expect(validateMapSpec(spec)).toBe("goal-on-wall");
  });

  // 终审 F1：越界（负 / ≥rows·cols）不得 TypeError 逃逸八枚举契约——
  // 越界格「非 0 即墙」，同口径归 on-wall 枚举（walk.ts「越界归 into-wall」同款裁定）
  it("start-on-wall：start 越界（负 r）归 start-on-wall，不抛 TypeError", () => {
    const spec: MapSpec = { ...legalSpec, start: { r: -1, c: 1 } };
    expect(validateMapSpec(spec)).toBe("start-on-wall");
  });

  it("goal-on-wall：goal 越界（c ≥ cols）归 goal-on-wall，不抛 TypeError", () => {
    const spec: MapSpec = { ...legalSpec, goal: { r: 3, c: 5 } };
    expect(validateMapSpec(spec)).toBe("goal-on-wall");
  });

  it("start-equals-goal：start==goal", () => {
    const spec: MapSpec = { ...legalSpec, goal: { r: 1, c: 1 } };
    expect(validateMapSpec(spec)).toBe("start-equals-goal");
  });

  it("unsolvable：墙隔断不可达", () => {
    const grid = [
      [1, 1, 1, 1, 1],
      [1, 0, 1, 0, 1],
      [1, 1, 1, 1, 1],
      [1, 0, 1, 0, 1],
      [1, 1, 1, 1, 1],
    ];
    const spec: MapSpec = { ...legalSpec, grid };
    expect(validateMapSpec(spec)).toBe("unsolvable");
    expect(bfsSolvable(spec)).toBe(false);
  });
});

describe("bfsSolvable", () => {
  it("合法 spec 可解（四向 BFS）", () => {
    expect(bfsSolvable(legalSpec)).toBe(true);
  });
});

describe("gridHash", () => {
  it("格式 ^fnv1a:[0-9a-f]{8}$", () => {
    expect(gridHash(level001Grid)).toMatch(/^fnv1a:[0-9a-f]{8}$/);
  });

  it("同一 grid 稳定", () => {
    const a = gridHash(level001Grid);
    const b = gridHash(level001Grid.map((row) => [...row]));
    expect(a).toBe(b);
  });

  it("任一行改动变值", () => {
    const a = gridHash(level001Grid);
    const changed = level001Grid.map((row) => [...row]);
    changed[1][2] = 1;
    const b = gridHash(changed);
    expect(a).not.toBe(b);
    expect(typeof a).toBe("string");
    expect(typeof b).toBe("string");
    expect(a.startsWith("fnv1a:")).toBe(true);
    expect(b.startsWith("fnv1a:")).toBe(true);
  });
});

describe("level_001.json 契约自证", () => {
  it("data 文件过校验且可解", () => {
    const spec = level001 as unknown as MapSpec;
    expect(validateMapSpec(spec)).toBeNull();
    expect(bfsSolvable(spec)).toBe(true);
  });
});
