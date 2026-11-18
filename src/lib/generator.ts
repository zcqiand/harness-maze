// 种子化关卡包生成器：包号即种子，确定性产出 + 逐张合法性自证（裁定 8）
// recursive backtracker 保注必然连通，BFS 自证兜底（不过即 throw）。

import {
  validateMapSpec,
  bfsSolvable,
  type Cell,
  type MapSpec,
} from "./map";

export const MAPS_PER_PACK = 5;

/** Number.isInteger && n >= 1（UI 层守卫用；generatePack 内部另有 fail-fast） */
export function isValidPackNo(n: number): boolean {
  return Number.isInteger(n) && n >= 1;
}

/** 11 + 2 * min(packNo-1, 4)：pack1=11 … pack5=19 封顶 */
export function packSize(packNo: number): number {
  return 11 + 2 * Math.min(packNo - 1, 4);
}

export interface PackMaze {
  packNo: number;
  mapIndex: number; // 0 起
  spec: MapSpec;
}

/** FNV-1a 32 位：字符串 → u32 种子。私有实现，不与 map.ts gridHash 共享代码路径。 */
function fnv1aString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32：u32 状态，返回 [0,1) 浮点流（家族 2048 同款，手写） */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * recursive backtracker 挖迷宫：grid 全 1 起步，从奇数格 (1,1) 挖通道，
 * 步长 2 前进并打通中间墙。完美迷宫——任意两通道格必然连通。
 */
function carveMaze(size: number, rng: () => number): number[][] {
  const grid: number[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 1),
  );

  const dirs: Array<{ dr: number; dc: number }> = [
    { dr: -2, dc: 0 },
    { dr: 2, dc: 0 },
    { dr: 0, dc: -2 },
    { dr: 0, dc: 2 },
  ];

  const start: Cell = { r: 1, c: 1 };
  grid[start.r][start.c] = 0;
  const stack: Cell[] = [start];
  const visited = new Set<string>([`${start.r},${start.c}`]);

  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const candidates = dirs
      .map((d) => ({
        r: cur.r + d.dr,
        c: cur.c + d.dc,
        wallR: cur.r + d.dr / 2,
        wallC: cur.c + d.dc / 2,
      }))
      .filter(
        (n) =>
          n.r > 0 &&
          n.r < size - 1 &&
          n.c > 0 &&
          n.c < size - 1 &&
          !visited.has(`${n.r},${n.c}`),
      );

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const pick = candidates[Math.floor(rng() * candidates.length)];
    grid[pick.wallR][pick.wallC] = 0; // 打通中间墙
    grid[pick.r][pick.c] = 0;
    visited.add(`${pick.r},${pick.c}`);
    stack.push({ r: pick.r, c: pick.c });
  }

  return grid;
}

/** 生成单张并自证：validateMapSpec===null && bfsSolvable===true，不过即 throw（裁定 8） */
function generateOne(packNo: number, mapIndex: number, size: number): PackMaze {
  const seed = fnv1aString(`hmaze:p${packNo}:m${mapIndex}`);
  const rng = mulberry32(seed);
  const grid = carveMaze(size, rng);

  const spec: MapSpec = {
    name: `p${packNo}-m${mapIndex}`,
    grid,
    start: { r: 1, c: 1 },
    goal: { r: size - 2, c: size - 2 },
  };

  const err = validateMapSpec(spec);
  if (err !== null) {
    throw new Error(
      `generator self-check failed: p${packNo}-m${mapIndex} -> ${err}`,
    );
  }
  if (!bfsSolvable(spec)) {
    throw new Error(`generator self-check failed: p${packNo}-m${mapIndex} unsolvable`);
  }

  return { packNo, mapIndex, spec };
}

/** 非法包号抛 RangeError（UI 层先用 isValidPackNo 守卫） */
export function generatePack(packNo: number): PackMaze[] {
  if (!isValidPackNo(packNo)) {
    throw new RangeError(`invalid packNo: ${packNo}`);
  }
  const size = packSize(packNo);
  const pack: PackMaze[] = [];
  for (let mapIndex = 0; mapIndex < MAPS_PER_PACK; mapIndex++) {
    pack.push(generateOne(packNo, mapIndex, size));
  }
  return pack;
}
