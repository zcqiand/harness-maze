// 端到端 lib 流探针（Task 8 Step 1）：不碰 UI，串全链——
// generatePack → createRun+playerInput 走线到 goal → assertWalkLegal 认证 → saveGhost
// → 新 loadRecords → compareGhost 取幽灵 → steps 与保存走线全等。
// 再加认证拒收链：篡改 steps 一格 → assertWalkLegal 抛 into-wall
//（幽灵被认证机构当场拒收——书 ch9 practice 原题的独立钉死）。
// 集成缝探针：若红，修缝不修模块。

import { describe, expect, it } from "vitest";
import { generatePack } from "../lib/generator";
import { gridHash, type Cell, type MapSpec } from "../lib/map";
import { createRun, playerInput, REPEAT_MS, type Dir } from "../lib/engine";
import { assertWalkLegal, WalkViolationError } from "../lib/walk";
import { compareGhost, loadRecords, saveGhost } from "../lib/ghosts";
import { MemoryStorage } from "../lib/storage";

/** BFS 最短路径：start → goal 含两端（测试脚手架，只用于构造合法走线） */
function bfsPath(spec: MapSpec): Cell[] {
  const key = (c: Cell): string => `${c.r},${c.c}`;
  const prev = new Map<string, string | null>([[key(spec.start), null]]);
  const queue: Cell[] = [spec.start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.r === spec.goal.r && cur.c === spec.goal.c) break;
    const deltas: Array<readonly [number, number]> = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dr, dc] of deltas) {
      const n: Cell = { r: cur.r + dr, c: cur.c + dc };
      if (spec.grid[n.r]?.[n.c] !== 0) continue;
      if (prev.has(key(n))) continue;
      prev.set(key(n), key(cur));
      queue.push(n);
    }
  }
  const path: Cell[] = [];
  let k: string | null = key(spec.goal);
  while (k !== null) {
    const [r, c] = k.split(",").map(Number);
    path.unshift({ r: r!, c: c! });
    k = prev.get(k) ?? null;
  }
  return path;
}

/** 相邻两格 → Dir（测试脚手架） */
function dirOf(a: Cell, b: Cell): Dir {
  if (b.r === a.r - 1 && b.c === a.c) return "up";
  if (b.r === a.r + 1 && b.c === a.c) return "down";
  if (b.r === a.r && b.c === a.c - 1) return "left";
  return "right";
}

describe("端到端 lib 流（认证先于入档）", () => {
  it("generatePack(1) m0：走线→认证→入档→重查→幽灵 steps 与保存走线全等", () => {
    const m0 = generatePack(1).find((m) => m.mapIndex === 0)!;
    const spec = m0.spec;
    expect(m0.packNo).toBe(1);
    expect(m0.mapIndex).toBe(0);

    // BFS 合法走线 → 引擎序列喂入
    const path = bfsPath(spec);
    expect(path[0]).toEqual(spec.start);
    expect(path[path.length - 1]).toEqual(spec.goal);

    const TICK = REPEAT_MS; // 引擎连走节拍单源（评审 I-3：不硬编码，引擎调拍不漂移）
    const T0 = 1000;
    let run = createRun(spec);
    for (let i = 1; i < path.length; i++) {
      run = playerInput(run, dirOf(path[i - 1]!, path[i]!), T0 + i * TICK);
    }
    expect(run.phase).toBe("finished");
    // 引擎首输入起表（首输入在 T0+TICK）→ result = (path.length-2)*TICK；
    // steps 末项 t 恒等 result（认证一致性）
    expect(run.result).toBe((path.length - 2) * TICK);
    expect(run.steps[run.steps.length - 1]!.t).toBe(run.result);

    // 认证先于入档：完赛走线先过 assertWalkLegal
    expect(() => assertWalkLegal(spec, run.steps, run.result!)).not.toThrow();

    // 认证通过才 saveGhost → 新 loadRecords → compareGhost
    const storage = new MemoryStorage();
    saveGhost(
      storage,
      {
        packNo: m0.packNo,
        mapIndex: m0.mapIndex,
        gridHash: gridHash(spec.grid),
        steps: run.steps,
        result: { time: run.result! },
      },
      9999,
    );
    const reread = loadRecords(storage);
    const { ghost } = compareGhost(reread, m0.packNo, m0.mapIndex, gridHash(spec.grid));
    expect(ghost).not.toBeNull();
    expect(ghost!.steps).toEqual(run.steps); // 全等：回放的幽灵就是认证过的走线
    expect(ghost!.result.time).toBe(run.result);
  });

  it("认证拒收链：篡改 steps 一格 → assertWalkLegal 抛 into-wall", () => {
    const m0 = generatePack(1).find((m) => m.mapIndex === 0)!;
    const spec = m0.spec;
    const path = bfsPath(spec);
    let run = createRun(spec);
    for (let i = 1; i < path.length; i++) {
      run = playerInput(run, dirOf(path[i - 1]!, path[i]!), 1000 + i * REPEAT_MS);
    }
    expect(run.phase).toBe("finished");

    // 篡改第 2 步一格到越界格（r=-1）——walk.ts 裁定「越界先归 into-wall」，
    // 这是单格篡改下 into-wall 的确定性构造（首步非法走 not-from-start 短路，不入 into-wall）
    const tampered = run.steps.map((s, i) =>
      i === 1 ? { ...s, cell: { r: -1, c: s.cell.c } } : s,
    );

    let caught: unknown = null;
    try {
      assertWalkLegal(spec, tampered, run.result!);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(WalkViolationError);
    expect((caught as WalkViolationError).reason).toBe("into-wall");
    expect((caught as WalkViolationError).stepIndex).toBe(1);
  });
});
