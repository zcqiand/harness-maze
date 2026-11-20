// 地图规约：MapSpec + 校验枚举 + gridHash 身份（裁定 10：关卡身份 = grid 哈希）
// 0 = 通道，1 = 墙；相邻 = 四向（上下左右）。

export interface Cell {
  r: number;
  c: number;
}

export interface MapSpec {
  name: string;
  grid: number[][];
  start: Cell;
  goal: Cell;
}

export type MapSpecError =
  | "grid-empty"
  | "grid-ragged"
  | "bad-cell-value"
  | "no-border-wall"
  | "start-on-wall"
  | "goal-on-wall"
  | "start-equals-goal"
  | "unsolvable";

/** 按枚举顺序短路返回首个错误；合法返回 null。 @impl M01.F02.I01 */
export function validateMapSpec(spec: MapSpec): MapSpecError | null {
  const { grid, start, goal } = spec;

  if (grid.length === 0) return "grid-empty";

  const rows = grid.length;
  const cols = grid[0].length;
  for (let r = 1; r < rows; r++) {
    if (grid[r].length !== cols) return "grid-ragged";
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const v = grid[r][c];
      if (v !== 0 && v !== 1) return "bad-cell-value";
    }
  }

  const lastRow = rows - 1;
  const lastCol = cols - 1;
  for (let r = 0; r < rows; r++) {
    if (grid[r][0] === 0 || grid[r][lastCol] === 0) return "no-border-wall";
  }
  for (let c = 0; c < cols; c++) {
    if (grid[0][c] === 0 || grid[lastRow][c] === 0) return "no-border-wall";
  }

  // 越界（负 / ≥rows·cols）的格子「非 0 即墙」——可选链取不到值同归 on-wall 枚举，
  // 不抛 TypeError 逃逸八枚举契约（map-spec.md 成文承诺；walk.ts「越界归 into-wall」同款口径）
  if (grid[start.r]?.[start.c] !== 0) return "start-on-wall";
  if (grid[goal.r]?.[goal.c] !== 0) return "goal-on-wall";
  if (start.r === goal.r && start.c === goal.c) return "start-equals-goal";

  if (!bfsSolvable(spec)) return "unsolvable";

  return null;
}

/**
 * FNV-1a 32 位，对 JSON.stringify(grid) 逐字符计算。
 * offset basis 2166136261，prime 16777619；输出 "fnv1a:<8位hex>"。
 */
export function gridHash(grid: number[][]): string {
  let hash = 2166136261;
  const s = JSON.stringify(grid);
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // 转 8 位无符号 hex（hash >>> 0 已是无符号 32 位）
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `fnv1a:${hex}`;
}

/** 四向 BFS 判 start→goal 连通性；防环用 visited 集合。 */
/** @impl M01.F02.I02 */
export function bfsSolvable(spec: MapSpec): boolean {
  const { grid, start, goal } = spec;
  const rows = grid.length;
  if (rows === 0) return false;
  const cols = grid[0].length;

  const key = (r: number, c: number) => `${r},${c}`;
  const visited = new Set<string>([key(start.r, start.c)]);
  const queue: Cell[] = [start];

  while (queue.length > 0) {
    const { r, c } = queue.shift() as Cell;
    if (r === goal.r && c === goal.c) return true;
    const neighbors: Cell[] = [
      { r: r - 1, c },
      { r: r + 1, c },
      { r, c: c - 1 },
      { r, c: c + 1 },
    ];
    for (const n of neighbors) {
      if (n.r < 0 || n.r >= rows || n.c < 0 || n.c >= cols) continue;
      if (grid[n.r][n.c] !== 0) continue;
      const k = key(n.r, n.c);
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push(n);
    }
  }
  return false;
}
