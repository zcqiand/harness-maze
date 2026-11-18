# harness-maze 合法幽灵竞速 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 harness-maze 从 Godot 骨架换栈为 React（家族 2048/snake 同款）并写成完整可玩的迷宫竞速，突出点=「合法幽灵」：最快走线存成幽灵与你同跑，认证双闸（走线合法性断言+存档校验）让作弊在结构上不可能。

**Architecture:** 纯逻辑全在 `src/lib/`（规约/生成器/认证/存档/引擎，TDD 先红），UI 层是薄壳（React 19 函数组件，唯一 Date.now/Math.random 允许地，静态 SSR 渲染断言测试）。地图从 `data/levels/` JSON 契约加载，游戏内关卡只走种子化包。

**Tech Stack:** React ^19.1 / Tailwind ^4.1 / TypeScript ~5.8.3 strict / Vite ^6.3 / vitest ^3.2.4，零新增依赖（RNG/checksum 手写 mulberry32+FNV-1a，家族同款）。

**Spec:** `docs/superpowers/specs/2026-11-18-ghost-racer-maze-design.md`（同仓，含 14 条关键设计裁定——本计划按裁定 1-14 实现，冲突时以 spec 为准）

## Global Constraints

- 零新增 npm 依赖；npm 安装一律 `--registry=https://registry.npmmirror.com`
- 版本钉 `version-lock.json`，React/Tailwind/Vite/TS/vitest 版本照抄 harness-snake（`../harness-snake/version-lock.json`、`../harness-snake/package.json`），@types/node 用 ^24（**禁 ^26**，首推锁漂移坑）
- 存档键一律 `hmaze.v1.*` 前缀；记录含 version 语义字段
- `src/lib/` 纯逻辑 TDD：先写失败测试再实现；UI 组件测试用 `react-dom/server` 的 `renderToStaticMarkup`（snake ScoreBook.test.tsx 同款，零新增依赖）
- UI 层是唯一允许 `Date.now()`/`Math.random()` 的地方；引擎时间全部注入（`nowMs` 参数）
- 地图契约化：`data/levels/` JSON 是规约样例与测试 fixture（裁定 13：不进游戏运行时路径）；游戏内关卡只由生成器产出
- 提交禁 `git add -A`，逐文件显式 add；commit 末尾带 `Co-Authored-By: Claude Code <noreply@anthropic.com>`
- 分支 `feat/ghost-racer-maze`（自 master）；tag/部署不在本计划（挂账部署批）

## Review Focus

1. **Cookie 阻断/隐私模式**：`globalThis.localStorage` 访问抛 SecurityError → `safeLocalStorage()` 回落内存假件，游戏可玩不白屏（成绩不保留可接受）。测试钉在 storage.test。
2. **篡改单条存档**（改 steps 任一 cell、改 result.time、改 checksum 本身）：只拒收该条，其余记录完好不连坐。测试钉在 ghosts.test。
3. **gridHash 不符的旧版记录**：封存可见（成绩册标注旧版）但不可赛不可记档，绝不静默丢弃。测试钉在 ghosts.test compareGhost。
4. **非法包号**（0 / -1 / 1.5 / NaN / Infinity）：`isValidPackNo` 判 false，UI 回落选包页不抛错。测试钉在 generator.test。
5. **幽灵时间戳异常**（t 非单调递增 / 负 t / 空 steps / result.time ≠ 末步 t）：认证拒收并报违规步号。测试钉在 walk.test。

---

### Task 1: 骨架换栈 Godot→React

**Files:**
- Delete: `project.godot`, `scenes/`（整个目录）, `scripts/`（整个目录）
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/index.css`, `src/App.tsx`, `src/App.test.tsx`, `.gitignore`
- Modify: `version-lock.json`, `CLAUDE.md`, `README.md`

**Interfaces:**
- Produces: 可跑的 React 骨架——`npm test`（vitest）/`npm run build`（tsc+vite）双门绿，App 渲染占位文案。后续任务全部在此地基上增文件，不动本任务钉死的配置文件。

- [ ] **Step 1: 删 Godot 工程件**

```bash
git rm -r project.godot scenes scripts
```

- [ ] **Step 2: 照抄 harness-snake 家族骨架**

逐文件复制自 `../harness-snake/`（同家族同款，版本钉死在其中）：`tsconfig.json`、`vite.config.ts`、`src/main.tsx`、`src/index.css`、`.gitignore`。`package.json` 复制后改两处：`"name": "harness-maze"`、`"version": "0.1.0"` 保持。`index.html` 复制后改 `<title>` 为 `迷宫竞速 harness-maze`（页面正文占位）。确认 tsconfig 含 `"resolveJsonModule": true`（没有就加，Task 2 的 JSON import 依赖它）。

- [ ] **Step 3: App 占位组件 + 失败测试**

`src/App.tsx`：函数组件渲染 `<main>` 内一个 `<h1>` 文案 `合法幽灵竞速`。`src/App.test.tsx`：

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import App from "./App";

describe("App 骨架", () => {
  it("渲染占位标题", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("合法幽灵竞速");
  });
});
```

- [ ] **Step 4: 安装依赖并验绿**

Run: `npm install --registry=https://registry.npmmirror.com`，然后 `npm test`（1 例 PASS）+ `npm run build`（tsc+vite 绿）。

- [ ] **Step 5: version-lock / CLAUDE.md / README 换栈回填**

`version-lock.json`：godot 条目删除，写入 React 栈版本（与 package.json 逐字一致，注明「2026-11-18 人裁 maze 换栈 React，Godot 槽让渡 jumper/cardbattle」）。`CLAUDE.md` 重写：家族铁律保留（版本钉死 / TDD 纯逻辑先红 / 地图契约化 JSON / 存档原子性=双键版本化切换 / 零伪代码 / 只增不改 / npm 走 npmmirror / tag 规约 `v<MAJOR>.<MINOR>.<PATCH>-<YYYYMMDD>`），Godot headless 验跑段替换为 vitest/build 双门。`README.md` 重写：一句话定位（合法幽灵竞速迷宫）+ 双门命令。

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html .gitignore version-lock.json CLAUDE.md README.md src/main.tsx src/index.css src/App.tsx src/App.test.tsx
git commit -m "feat: 骨架换栈 Godot→React（家族 2048/snake 同款，2026-11-18 人裁）"
```

---

### Task 2: 地图规约 map.ts + map-spec.md + level_001 演化

**Files:**
- Create: `src/lib/map.ts`, `src/lib/map.test.ts`, `docs/conventions/map-spec.md`
- Modify: `data/levels/level_001.json`

**Interfaces:**
- Consumes: 无（首个 lib 模块）
- Produces（Task 3/4/5/6 全依赖）:

```ts
export interface Cell { r: number; c: number }
export interface MapSpec { name: string; grid: number[][]; start: Cell; goal: Cell }
export type MapSpecError =
  | "grid-empty" | "grid-ragged" | "bad-cell-value" | "no-border-wall"
  | "start-on-wall" | "goal-on-wall" | "start-equals-goal" | "unsolvable";
export function validateMapSpec(spec: MapSpec): MapSpecError | null;
export function gridHash(grid: number[][]): string;      // "fnv1a:<8位hex>"，FNV-1a 32位
export function bfsSolvable(spec: MapSpec): boolean;      // 0=通道 1=墙，四向相邻
```

- [ ] **Step 1: 写失败测试** `src/lib/map.test.ts`——覆盖：合法 spec（用 Task Step 3 的 level_001 内容内联构造）`validateMapSpec` 返回 `null` 且 `bfsSolvable` 为真；八种 `MapSpecError` 各一例（空 grid / 行不等长 / 含 2 / 边界开口 / start 落墙 / goal 落墙 / start==goal / 墙隔断不可达）；`gridHash` 对同一 grid 稳定、对任一行改动变值（断言两个不同字符串，具体 hex 值不钉死——只钉 `"fnv1a:"` 前缀与格式 `^fnv1a:[0-9a-f]{8}$`）。
- [ ] **Step 2: 跑红** `npx vitest run src/lib/map.test.ts` → FAIL（模块不存在）。
- [ ] **Step 3: 实现 `src/lib/map.ts`**——validateMapSpec 按枚举顺序短路返回首个错误；gridHash 用 FNV-1a 32 位（offset basis 2166136261，prime 16777619，逐字节异或乘法定点），对 `JSON.stringify(grid)` 逐字符计算，输出 `fnv1a:` + 8 位 hex；bfsSolvable 队列 BFS，防环用 visited 集合。
- [ ] **Step 4: 跑绿** 同命令全 PASS。
- [ ] **Step 5: level_001.json 演化 + 契约文档**

`data/levels/level_001.json` 补 start/goal（grid 不动）：

```json
{
  "name": "sample-corridor",
  "grid": [[1,1,1,1,1],[1,0,0,0,1],[1,1,1,0,1],[1,0,0,0,1],[1,1,1,1,1]],
  "start": { "r": 1, "c": 1 },
  "goal": { "r": 3, "c": 3 }
}
```

`map.test.ts` 增一条：`import level001 from "../../data/levels/level_001.json"` 断言 validateMapSpec 为 null 且 bfsSolvable 为真（契约文件自证）。`docs/conventions/map-spec.md` 成文：字段表、0/1 语义、八种非法枚举、gridHash 身份语义（裁定 10：关卡身份=grid 哈希）。
- [ ] **Step 6: 跑绿 + Commit**

```bash
git add src/lib/map.ts src/lib/map.test.ts docs/conventions/map-spec.md data/levels/level_001.json
git commit -m "feat: 地图规约 MapSpec+校验枚举+gridHash 身份，level_001 升规约样例"
```

---

### Task 3: 种子生成器 generator.ts

**Files:**
- Create: `src/lib/generator.ts`, `src/lib/generator.test.ts`

**Interfaces:**
- Consumes: `MapSpec/Cell/validateMapSpec/bfsSolvable`（Task 2 签名）
- Produces（Task 6/7/8 依赖）:

```ts
export const MAPS_PER_PACK = 5;
export function isValidPackNo(n: number): boolean;        // Number.isInteger && n >= 1
export function packSize(packNo: number): number;         // 11 + 2 * Math.min(packNo - 1, 4)，11→19 封顶
export interface PackMaze { packNo: number; mapIndex: number; spec: MapSpec }  // mapIndex 0 起
export function generatePack(packNo: number): PackMaze[]; // 非法包号抛 RangeError（UI 层先用 isValidPackNo 守卫）
```

- [ ] **Step 1: 写失败测试**——`isValidPackNo`：1/2/19 真，0/-1/1.5/NaN/Infinity 假；`packSize`：pack1=11、pack4=17、pack5=19、pack99=19；`generatePack(1)`：长度 5、每张 `validateMapSpec(spec)===null`、`bfsSolvable===true`、尺寸=11、spec.name 形如 `p1-m0`；**确定性**：`generatePack(3)` 两次调用 JSON.stringify 全等，且 `generatePack(3)` ≠ `generatePack(4)`；非法包号 `generatePack(0)` 抛 RangeError。
- [ ] **Step 2: 跑红** `npx vitest run src/lib/generator.test.ts` → FAIL。
- [ ] **Step 3: 实现**——种子推导 `fnv1aString("hmaze:p${packNo}:m${mapIndex}")`（FNV-1a 字符串→32位种子，本文件内实现一个私有 `fnv1aString`，不与 gridHash 共享实现细节）；RNG 用 mulberry32（家族 2048 同款，手写）；recursive backtracker：grid 全 1 起步，从奇数格 (1,1) 挖通道（步长 2 打通中间墙），起点 `{r:1,c:1}` 终点 `{r:size-2,c:size-2}`（backtracker 保注必然连通，BFS 自证兜底）；每张产出后自证：`validateMapSpec===null && bfsSolvable===true`，不过即 throw（生成器自证，裁定 8）。
- [ ] **Step 4: 跑绿** 全 PASS。
- [ ] **Step 5: Commit**

```bash
git add src/lib/generator.ts src/lib/generator.test.ts
git commit -m "feat: 种子化关卡包生成器（backtracker+自证，包号即种子）"
```

---

### Task 4: 走线认证 walk.ts

**Files:**
- Create: `src/lib/walk.ts`, `src/lib/walk.test.ts`

**Interfaces:**
- Consumes: `MapSpec/Cell`（Task 2）、合法 spec 测试样本自构
- Produces（Task 5/6/8 依赖）:

```ts
export interface Step { t: number; cell: Cell }   // t = 本步相对开局毫秒，须严格递增
export type WalkViolationReason =
  | "empty" | "not-from-start" | "not-to-goal"
  | "step-not-adjacent" | "into-wall" | "time-inconsistent";
export class WalkViolationError extends Error {
  readonly stepIndex: number;   // 违规步号（0 起；empty=-1；not-to-goal=末步号）
  readonly reason: WalkViolationReason;
}
export function assertWalkLegal(spec: MapSpec, steps: readonly Step[], resultTime: number): void;
```

- [ ] **Step 1: 写失败测试**——用一张 5×5 手工 spec（走廊式，start(1,1)→goal(3,1)）逐条断言：合法走线（两步，t=520/1040，resultTime=1040）不抛；空 steps → `empty`；首格≠start → `not-from-start` stepIndex=0；末格≠goal → `not-to-goal`；相邻步跨 2 格 → `step-not-adjacent` stepIndex=1；目标格是墙 → `into-wall`；resultTime ≠ 末步 t → `time-inconsistent`；t 回退（第二步 t 小于第一步）→ `time-inconsistent`；负 t → `time-inconsistent`。每例断言 `reason` 与 `stepIndex`。
- [ ] **Step 2: 跑红** `npx vitest run src/lib/walk.test.ts` → FAIL。
- [ ] **Step 3: 实现**——按枚举顺序短路：empty → 首格=start → 末格=goal → 逐步（曼哈顿距离 1 / 目标格非墙 / t 严格递增且 ≥0）→ resultTime===末步 t。抛 `WalkViolationError`（message 带步号与 reason）。
- [ ] **Step 4: 跑绿** 全 PASS。
- [ ] **Step 5: Commit**

```bash
git add src/lib/walk.ts src/lib/walk.test.ts
git commit -m "feat: 走线合法性断言（认证判定器，违规步号入错）"
```

---

### Task 5: 存储底座 storage.ts + 幽灵存档 ghosts.ts

**Files:**
- Create: `src/lib/storage.ts`, `src/lib/storage.test.ts`, `src/lib/ghosts.ts`, `src/lib/ghosts.test.ts`

**Interfaces:**
- Consumes: `Step`（Task 4）、`gridHash` 语义（Task 2）
- Produces（Task 7/8 依赖）:

```ts
// storage.ts
export class MemoryStorage implements Storage { /* 全 6 成员：length/clear/getItem/key/removeItem/setItem，模块级单例 */ }
export function safeLocalStorage(): Storage;   // try globalThis.localStorage 探活（setItem+removeItem 回环）成功用真件，否则 MemoryStorage 单例

// ghosts.ts
export const RECORDS_KEY_A = "hmaze.v1.records.0";
export const RECORDS_KEY_B = "hmaze.v1.records.1";
export const RECORDS_HEAD_KEY = "hmaze.v1.records.head";   // "0" | "1"
export interface GhostRecord {
  packNo: number; mapIndex: number; gridHash: string;
  steps: Step[]; result: { time: number };
  savedAt: number; checksum: string;
}
export function recordKey(packNo: number, mapIndex: number): string;   // "${packNo}:${mapIndex}"
export function recordChecksum(rec: Omit<GhostRecord, "checksum">): string;  // FNV-1a 于 stable stringify，"fnv1a:<hex8>"
export function isPersonalBest(existing: GhostRecord | undefined, time: number): boolean;  // 无→true；time<existing→true；平局→false
export function saveGhost(storage: Storage, rec: Omit<GhostRecord, "checksum" | "savedAt">, nowMs: number): GhostRecord;
  // 计 checksum+savedAt；已有 PB 更快才覆盖（平局先到先得）；双键版本化原子写：写非 head 键→翻 head；任一步 try/catch 静默降级
export function loadRecords(storage: Storage): Map<string, GhostRecord>;
  // 读 head 键→解析→**逐条**验 checksum：坏一条弃一条不连坐；head 键坏/缺失→回落另一键→双坏返回空 Map（不抛不白屏）
export function compareGhost(records: Map<string, GhostRecord>, packNo: number, mapIndex: number, currentHash: string):
  { ghost: GhostRecord | null; sealed: GhostRecord | null };
  // 无记录→{null,null}；gridHash 相等→ghost；不等→sealed（旧版封存：成绩册可见、不可赛，裁定 10）
```

- [ ] **Step 1: 写失败测试 storage.test.ts**——`safeLocalStorage` 在真 localStorage 环境返回同域真件；用 `Object.defineProperty(globalThis, "localStorage", { get() { throw new SecurityError 形状的 Error } })` 模拟 Cookie 阻断（**vi.stubGlobal 或 defineProperty，测毕 vi.unstubAllGlobals/恢复**）→ 返回 MemoryStorage 且不抛；MemoryStorage 六成员行为（set/get/key/length/remove/clear）。
- [ ] **Step 2: 跑红** storage.test → FAIL。实现 storage.ts（MemoryStorage 模块级单例 `let mem: MemoryStorage | null`）→ 跑绿。
- [ ] **Step 3: 写失败测试 ghosts.test.ts**——用内存假件：①save 后 load 全等回读（含 checksum 一致）；②篡改回读副本任一 cell 再伪造 checksum 或直接改 storage 里序列化串的一个字符→load 该条被弃、**另一条完好**（先存两条）；③head 键写坏 JSON→回落另一键旧快照（先 save 两次制造两代快照）；④双键全坏→空 Map 不抛；⑤`isPersonalBest`：无记录真 / 更快真 / 更慢假 / 平局假；⑥`compareGhost`：hash 等→ghost / hash 异→sealed / 无→双 null；⑦saveGhost PB 慢于现存→现存不动（savedAt 不变）；⑧非法走线**不经此处拦**——本模块只管存取完整性（防越界测试：saveGhost 不调用 assertWalkLegal，注释言明分层）。
- [ ] **Step 4: 跑红 → 实现 ghosts.ts → 跑绿**。stable stringify：对象键按固定顺序（packNo,mapIndex,gridHash,steps,result,savedAt）手工拼，不依赖 JSON.stringify 键序。
- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts src/lib/ghosts.ts src/lib/ghosts.test.ts
git commit -m "feat: 存储底座（safeLocalStorage+内存假件）+幽灵存档（双键原子写+逐条校验+PB+封存）"
```

---

### Task 6: 游戏引擎 engine.ts

**Files:**
- Create: `src/lib/engine.ts`, `src/lib/engine.test.ts`

**Interfaces:**
- Consumes: `MapSpec/Cell`（Task 2）
- Produces（Task 7/8 依赖）:

```ts
export type Dir = "up" | "down" | "left" | "right";
export const DIR_DELTA: Record<Dir, Cell>;    // up={-1,0} down={1,0} left={0,-1} right={0,1}
export const REPEAT_MS = 140;                 // 按住连走间隔（裁定 1，builder check 授权自定值）
export type Phase = "ready" | "running" | "finished";
export interface RunState {
  phase: Phase; spec: MapSpec; cell: Cell;
  steps: Step[];                 // running 起记录，完赛含末步
  startedAt: number | null;      // 首输入起表锚（裁定 9）
  nowMs: number;                 // 最近一次注入时钟，驱动 HUD
  result: number | null;         // finished 时 = nowMs - startedAt
}
export function createRun(spec: MapSpec): RunState;                       // phase=ready cell=start steps=[]
export function playerInput(run: RunState, dir: Dir, nowMs: number): RunState;
  // ready+首输入：startedAt=nowMs 转 running 并落首步（t=0）
  // running：合法移动→落步 {t: nowMs-startedAt, cell}；撞墙→cell/steps 不变（时钟不停，裁定 3）
  // 到达 goal→finished，result=nowMs-startedAt，末步照落
  // finished 后输入：原样返回
export function ghostCellAt(steps: readonly Step[], elapsedMs: number, start: Cell): Cell;
  // 最近一个 t<=elapsedMs 的步位；无→start；越末→末步位（离散语义，渲染插值归 UI）
```

- [ ] **Step 1: 写失败测试**——用 5×5 走廊 spec：①createRun 初始态（ready/start/空 steps/startedAt null）；②首输入起表：ready 态 `playerInput(run,"right",1000)` → phase running、startedAt=1000、首步 `{t:0,start 右邻}`；③连走计时：t=1400 再输入 → 步 `{t:400,...}`；④撞墙：朝墙输入 → cell 与 steps 长度不变、phase 仍 running；⑤完赛：走到 goal → finished、result=nowMs-startedAt、末步在 steps 内且 cell=goal；⑥finished 后输入原样返回（引用相等）；⑦`ghostCellAt`：elapsed 在首步前=start、两步之间=前一步位、越末=末步位。
- [ ] **Step 2: 跑红** `npx vitest run src/lib/engine.test.ts` → FAIL。
- [ ] **Step 3: 实现**——纯函数每次返回新 RunState（finished 直通除外）；撞墙无副作用不落步；墙判定 `spec.grid[r]?.[c] !== 0`（越界=墙）。
- [ ] **Step 4: 跑绿** 全 PASS。
- [ ] **Step 5: Commit**

```bash
git add src/lib/engine.ts src/lib/engine.test.ts
git commit -m "feat: 竞速引擎（首输入起表+墙阻不判负+幽灵离散驱动）"
```

---

### Task 7: UI 选包/选图/成绩册

**Files:**
- Create: `src/ui/PackSelect.tsx`, `src/ui/MazeSelect.tsx`, `src/ui/GhostPanel.tsx`, `src/ui/GhostPanel.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `generatePack/isValidPackNo/packSize`（Task 3）、`loadRecords/compareGhost/isPersonalBest/recordKey`（Task 5）、`gridHash`（Task 2）
- Produces（Task 8 依赖）:

```tsx
// App.tsx 顶层路由态（本任务定形，Task 8 只加 game 态）
export type Screen =
  | { kind: "packs" }
  | { kind: "mazes"; packNo: number }
  | { kind: "game"; packNo: number; mapIndex: number };
// PackSelect: 包号 1..5 直列 + 自定义输入框（isValidPackNo 守卫，非法回落不动，裁定 14）
// MazeSelect: 5 张图卡片（名称+尺寸+最佳时间+幽灵在位标记；sealed 标「旧版」禁点，裁定 10）
// GhostPanel props:
export function GhostPanel(props: {
  ghost: GhostRecord | null;      // 在位幽灵
  sealed: GhostRecord | null;     // 旧版封存
}): JSX.Element;                  // 显示最佳时间/幽灵在位/旧版封存标注
```

- [ ] **Step 1: 写失败测试 GhostPanel.test.tsx**——renderToStaticMarkup 三态：ghost 在位→含最佳时间文本（如 `12.340`）与「幽灵在位」；sealed→含「旧版封存」且**不含**「幽灵在位」；双 null→含「暂无幽灵」。时间格式化私有函数 `formatMs(ms): string`（`12.340` 形状：秒.三位毫秒）放 GhostPanel 内并导出供 Task 8 HUD 复用。
- [ ] **Step 2: 跑红 → 实现 → 跑绿**。PackSelect/MazeSelect 为纯渲染组件（props 进、回调出，不直接碰 storage——App 注入）；App 用 `useState<Screen>` 路由三态，包选/图选接 generatePack 与 loadRecords+compareGhost。
- [ ] **Step 3: 验证** `npm test` 全绿 + `npm run build` 绿（tsc strict 过）。
- [ ] **Step 4: Commit**

```bash
git add src/ui/PackSelect.tsx src/ui/MazeSelect.tsx src/ui/GhostPanel.tsx src/ui/GhostPanel.test.tsx src/App.tsx
git commit -m "feat: 选包/选图/成绩册三屏（幽灵在位+旧版封存标注）"
```

---

### Task 8: 竞速局 UI + 端到端流

**Files:**
- Create: `src/ui/BoardView.tsx`, `src/ui/Hud.tsx`, `src/ui/FinishPanel.tsx`, `src/ui/TouchPad.tsx`, `src/ui/flow.test.ts`
- Modify: `src/App.tsx`, `src/ui/GhostPanel.tsx`（导出 formatMs 供 Hud 复用，若 Task 7 未导出）

**Interfaces:**
- Consumes: Task 6 引擎全家（`createRun/playerInput/ghostCellAt/Dir/REPEAT_MS`）、Task 5 存档全家、Task 4 `assertWalkLegal`、`formatMs`（Task 7）
- Produces: 完整可玩闭环。

- [ ] **Step 1: 端到端 lib 流失败测试 flow.test.ts**（不碰 UI，串全链）：generatePack(1) 取 m0 → 构造合法走线走 createRun+playerInput 序列到 goal → assertWalkLegal 通过 → saveGhost → 新 loadRecords → compareGhost 得 ghost → ghost.steps 与保存的走线全等。再加认证拒收链：篡改 steps 一格 → assertWalkLegal 抛 `into-wall`（幽灵被认证机构当场拒收——书 ch9 practice 原题的独立钉死）。
- [ ] **Step 2: 跑红** → 全链已有模块应即绿（此测试是集成缝的探针；若红，修缝不修模块）→ 绿。
- [ ] **Step 3: BoardView**——props `{ spec: MapSpec; player: Cell; ghost: Cell | null }`：grid 渲染（墙=深色块/通道=沥青底+白线网格），start/goal 标记，玩家块高亮，幽灵半透明轮廓叠层；不接时钟。
- [ ] **Step 4: Hud**——props `{ run: RunState }`：running 显示 `formatMs(nowMs - startedAt)`，finished 显示完赛时间。
- [ ] **Step 5: FinishPanel**——props `{ result: number; pb: GhostRecord | null; beatPb: boolean; onRetry: () => void; onBack: () => void }`：完赛时间、与 PB 差值（`±s.ms`，无 PB 显示「首个幽灵已认证入档」）、破 PB 高亮（裁定视觉：瞬时高亮文案「新幽灵上位」）、重赛/回选图按钮。
- [ ] **Step 6: TouchPad**——四向按钮（`data-fn="dpad-up|down|left|right"`），onDir 回调。
- [ ] **Step 7: App 接线 game 态**——`useEffect` 挂 `keydown`（WASD+方向键；keydown 重复触发即按住连走，浏览器原生 repeat 节奏不做额外队列——裁定 1）+ `requestAnimationFrame` 驱动 `nowMs` 注入与幽灵插值滑行（渲染层连续化：幽灵 CSS transition 位移 `REPEAT_MS` 时长近似）；Esc=放弃回选图不计档（裁定 2）；完赛→assertWalkLegal 认证通过才 saveGhost（**认证先于入档**——认证机构语义），破 PB 才覆盖；TouchPad onDir 同 playerInput。窗口事件路径不写 RTL 测试（零依赖约束下不可测，snake 先例同款豁免，逻辑已被引擎测试覆盖）。
- [ ] **Step 8: 验证** `npm test` 全绿 + `npm run build` 绿 + `npm run dev` 手验一轮（选包→跑图→完赛→幽灵在位→再跑同图影子同跑）。
- [ ] **Step 9: Commit**

```bash
git add src/ui/BoardView.tsx src/ui/Hud.tsx src/ui/FinishPanel.tsx src/ui/TouchPad.tsx src/ui/flow.test.ts src/App.tsx src/ui/GhostPanel.tsx
git commit -m "feat: 竞速局闭环——认证先于入档，幽灵同跑+破PB上位+端到端流测试"
```
