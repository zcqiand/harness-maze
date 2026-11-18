# 地图规约 map-spec

> SSOT：`src/lib/map.ts`。关卡数据在 `data/levels/level_*.json`。
> 本文档是给人和后续任务（Task 3/4/5/6）读的契约说明，实现以 map.ts 为准。

## 字段表（MapSpec）

| 字段 | 类型 | 语义 |
|---|---|---|
| `name` | `string` | 关卡名（展示用，不参与身份） |
| `grid` | `number[][]` | 方格矩阵，行=`r`（北→南），列=`c`（西→东）；**0=通道，1=墙** |
| `start` | `Cell { r, c }` | 起点格，必须是通道 |
| `goal` | `Cell { r, c }` | 终点格，必须是通道，且 ≠ start |

## 合法性约束

1. `grid` 非空，所有行等长（矩形）
2. 每格值只能是 `0` 或 `1`
3. 最外圈（r=0 / r=rows-1 / c=0 / c=cols-1）必须全为 1（封闭边界墙）
4. `start`、`goal` 所在格值为 0
5. `start ≠ goal`
6. 四向 BFS 从 `start` 可达 `goal`

## 非法枚举（MapSpecError，校验按此顺序短路返回首个错误）

| 值 | 触发条件 |
|---|---|
| `grid-empty` | `grid.length === 0` |
| `grid-ragged` | 存在行长度 ≠ 首行长度 |
| `bad-cell-value` | 任一格值既非 0 也非 1 |
| `no-border-wall` | 最外圈存在 0（边界开口） |
| `start-on-wall` | `grid[start.r][start.c] === 1` |
| `goal-on-wall` | `grid[goal.r][goal.c] === 1` |
| `start-equals-goal` | start 与 goal 同格 |
| `unsolvable` | 四向 BFS 判不可达 |

`validateMapSpec(spec)` 合法返回 `null`，否则返回上表第一个命中的值。

## gridHash 身份语义（裁定 10）

**关卡身份 = grid 哈希**。同一 `grid` 矩阵 ⇒ 同一关卡，`name` / 起终点调整不改变身份；
`grid` 任一格变动 ⇒ 不同关卡。

- 算法：FNV-1a 32 位（offset basis `2166136261`，prime `16777619`）
- 输入：`JSON.stringify(grid)`，逐字符异或后乘法定点（`Math.imul` 保持 32 位）
- 输出：`"fnv1a:"` + 8 位小写 hex（零填充），如 `fnv1a:3f2a91c0`
- 用途：关卡解锁进度、每日同题种子局的关卡指纹，不作为安全哈希

## 参考实现导出（src/lib/map.ts）

```ts
export interface Cell { r: number; c: number }
export interface MapSpec { name: string; grid: number[][]; start: Cell; goal: Cell }
export type MapSpecError = /* 上表八种 */
export function validateMapSpec(spec: MapSpec): MapSpecError | null;
export function gridHash(grid: number[][]): string;
export function bfsSolvable(spec: MapSpec): boolean;
```

## 样例：level_001

`data/levels/level_001.json`（`sample-corridor`）：5×5，start (1,1) → goal (3,3)，
唯一主走廊 (1,1)→(1,2)→(1,3)→(2,3)→(3,3)。该文件被 `src/lib/map.test.ts`
以 JSON import 直接校验（契约文件自证）。
