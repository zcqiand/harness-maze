// 顶层路由（Task 7 定形，Task 8 实装 game 态）：packs → mazes → game。
// App 是唯一接 storage/generator 的地方：generatePack 产包、loadRecords+compareGhost
// 判每张图的幽灵在位/旧版封存，算成 MazeCardVM 注入纯渲染组件。
// 竞速局（GameScreen）：keydown(WASD+方向键，原生 repeat 连走——裁定 1) + 触屏四向同
// playerInput；rAF 只做渲染层连续化（nowMs 注入 HUD / 幽灵 ghostCellAt 离散取位 + CSS
// transition 滑行）。完赛先 assertWalkLegal 认证、通过才 saveGhost（认证先于入档），
// 入档后重查 loadRecords+compareGhost 驱动成绩面（Task 5 挂账：静默降级以重查为准）。
// Esc=放弃回选图不计档（裁定 2）。UI 层是唯一 Date.now 允许地。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { generatePack, packSize } from "./lib/generator";
import { gridHash } from "./lib/map";
import {
  compareGhost,
  loadRecords,
  saveGhost,
  type GhostRecord,
} from "./lib/ghosts";
import { safeLocalStorage } from "./lib/storage";
import { assertWalkLegal } from "./lib/walk";
import {
  createRun,
  ghostCellAt,
  playerInput,
  type Dir,
  type RunState,
} from "./lib/engine";
import { PackSelect } from "./ui/PackSelect";
import { MazeSelect, type MazeCardVM } from "./ui/MazeSelect";
import { GhostPanel } from "./ui/GhostPanel";
import { BoardView } from "./ui/BoardView";
import { Hud } from "./ui/Hud";
import { FinishPanel } from "./ui/FinishPanel";
import { TouchPad } from "./ui/TouchPad";

export type Screen =
  | { kind: "packs" }
  | { kind: "mazes"; packNo: number }
  | { kind: "game"; packNo: number; mapIndex: number };

function MazeScreen(props: {
  packNo: number;
  onBack: () => void;
  onSelect: (mapIndex: number) => void;
}): JSX.Element {
  const cards = useMemo<MazeCardVM[]>(() => {
    const pack = generatePack(props.packNo);
    const records = loadRecords(safeLocalStorage());
    return pack.map((m) => {
      const { ghost, sealed } = compareGhost(
        records,
        m.packNo,
        m.mapIndex,
        gridHash(m.spec.grid),
      );
      const best =
        ghost !== null ? ghost.result.time : sealed !== null ? sealed.result.time : null;
      return {
        mapIndex: m.mapIndex,
        name: m.spec.name,
        size: m.spec.grid.length,
        bestMs: best,
        ghostInPlace: ghost !== null,
        sealed: sealed !== null,
      };
    });
  }, [props.packNo]);

  return (
    <section>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={props.onBack}
          className="rounded border border-white/20 bg-neutral-800 px-3 py-1 text-sm text-white hover:border-white/60"
        >
          ← 返回选包
        </button>
        <h2 className="font-mono text-lg text-white">包 {props.packNo}</h2>
        <span className="text-xs text-neutral-500">尺寸 {packSize(props.packNo)}×{packSize(props.packNo)}</span>
      </div>
      <div className="mt-4">
        <MazeSelect mazes={cards} onSelect={props.onSelect} />
      </div>
    </section>
  );
}

/** WASD + 方向键 → Dir（keydown 原生 repeat 连走，不做额外队列——裁定 1） */
const KEY_DIR: Record<string, Dir> = {
  w: "up",
  W: "up",
  ArrowUp: "up",
  s: "down",
  S: "down",
  ArrowDown: "down",
  a: "left",
  A: "left",
  ArrowLeft: "left",
  d: "right",
  D: "right",
  ArrowRight: "right",
};

interface FinishInfo {
  result: number;
  /** 本局开跑前的在位幽灵（差值对它算） */
  pb: GhostRecord | null;
  /** 认证入档成功且上位（重查后的 compareGhost 结果驱动——Task 5 挂账） */
  beatPb: boolean;
  /** 该破 PB / 该首存但重查未见本局成绩 → 存储静默降级，成绩仅本局可见（认证拒收不走此语义） */
  degraded: boolean;
  /** assertWalkLegal 拒收（防御性兜底，正常完赛不可达）——与降级分流，勿混导向 */
  rejected: boolean;
}

function GameScreen(props: {
  packNo: number;
  mapIndex: number;
  onBack: () => void;
}): JSX.Element {
  const maze = useMemo(
    () =>
      generatePack(props.packNo).find((m) => m.mapIndex === props.mapIndex) ??
      null,
    [props.packNo, props.mapIndex],
  );
  const storage = useMemo(() => safeLocalStorage(), []);

  const [run, setRun] = useState<RunState | null>(() =>
    maze === null ? null : createRun(maze.spec),
  );
  const [ghost, setGhost] = useState<GhostRecord | null>(null);
  const [sealed, setSealed] = useState<GhostRecord | null>(null);
  const [finish, setFinish] = useState<FinishInfo | null>(null);
  /** 完赛存档只跑一次的护栏（StrictMode 双调 effect 防重；完赛 effect deps 含 ghost——入档后 setGhost 拽出的重入也靠本 ref 短路，认证/入档只落一次） */
  const savedRunRef = useRef<RunState | null>(null);
  /** onBack 经 ref 进 keydown 监听，避免每次 render 重挂 window 监听 */
  const onBackRef = useRef(props.onBack);
  useEffect(() => {
    onBackRef.current = props.onBack;
  }, [props.onBack]);

  // 评审 I-1：完赛收尾 effect 的 dep 提为 phase（非可选链写法，eslint exhaustive-deps
  // 口径内），run 本体走 ref——running 期 rAF 每帧换 run 引用，不再把完赛 effect 每帧拽重入。
  const phase = run === null ? null : run.phase;
  const runRef = useRef<RunState | null>(run);
  useEffect(() => {
    runRef.current = run; // 每渲染同步，声明序先于 rAF/完赛 effect，同 commit 内先落地
  });

  // 进图读档：幽灵在位/旧版封存（裁定 10）
  useEffect(() => {
    if (maze === null) return;
    const { ghost, sealed } = compareGhost(
      loadRecords(storage),
      maze.packNo,
      maze.mapIndex,
      gridHash(maze.spec.grid),
    );
    setGhost(ghost);
    setSealed(sealed);
  }, [maze, storage]);

  const inputDir = useCallback(
    (dir: Dir) =>
      setRun((r) => (r === null ? r : playerInput(r, dir, Date.now()))),
    [],
  );

  // rAF 渲染层连续化：running 时把 nowMs 注入 RunState（HUD 活表 + 幽灵离散取位）；
  // 引擎步进仍只在 playerInput（键盘/触屏），rAF 不产生步。
  useEffect(() => {
    if (phase !== "running") return;
    let raf = 0;
    const tick = () => {
      setRun((r) =>
        r !== null && r.phase === "running" ? { ...r, nowMs: Date.now() } : r,
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // 键盘：WASD + 方向键 + Esc（窗口事件路径零依赖限界不写 RTL 测试——snake 先例豁免）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.key];
      if (dir !== undefined) {
        e.preventDefault(); // 方向键防页面滚动
        inputDir(dir);
        return;
      }
      if (e.key === "Escape") {
        onBackRef.current(); // 放弃回选图，不计档（裁定 2）
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputDir]);

  // 完赛收尾：认证先于入档；入档后重查驱动成绩面（deps 只到 phase，run 走 runRef——评审 I-1）
  useEffect(() => {
    if (maze === null || phase !== "finished") return;
    const cur = runRef.current;
    if (cur === null || cur.phase !== "finished") return;
    if (savedRunRef.current === cur) return; // StrictMode 防重
    savedRunRef.current = cur;

    const result = cur.result ?? 0;
    const prevGhost = ghost;
    let rejected = false;
    try {
      assertWalkLegal(maze.spec, cur.steps, result); // 认证机构：不过即拒收不入档
      saveGhost(
        storage,
        {
          packNo: maze.packNo,
          mapIndex: maze.mapIndex,
          gridHash: gridHash(maze.spec.grid),
          steps: cur.steps,
          result: { time: result },
        },
        Date.now(),
      );
    } catch {
      // 认证拒收：不入档（引擎墙阻下正常完赛不会走到这，防御性兜底）。
      // 拒收≠降级（评审 I-2）：rejected 单列分流，不落「浏览器存储降级」误导文案。
      rejected = true;
    }
    // 重查（静默降级也以重查为准——Task 5 挂账收口）
    const { ghost: nextGhost, sealed: nextSealed } = compareGhost(
      loadRecords(storage),
      maze.packNo,
      maze.mapIndex,
      gridHash(maze.spec.grid),
    );
    setGhost(nextGhost);
    setSealed(nextSealed);
    const savedThis = nextGhost !== null && nextGhost.result.time === result;
    const shouldSave =
      prevGhost === null || result < prevGhost.result.time; // isPersonalBest 同口径
    setFinish({
      result,
      pb: prevGhost,
      beatPb: savedThis && prevGhost !== null,
      degraded: shouldSave && !savedThis && !rejected,
      rejected,
    });
  }, [maze, phase, storage, ghost]);

  if (maze === null) {
    return (
      <section>
        <button
          type="button"
          onClick={props.onBack}
          className="rounded border border-white/20 bg-neutral-800 px-3 py-1 text-sm text-white hover:border-white/60"
        >
          ← 返回选图
        </button>
        <p className="mt-4 text-sm text-neutral-500">图号无效。</p>
      </section>
    );
  }

  const retry = () => {
    savedRunRef.current = null;
    setFinish(null);
    setRun(createRun(maze.spec));
  };

  // maze 非空则 run 必非空（初始/retry 均 createRun）——守卫后的非空断言
  const cur = run!;

  // 幽灵离散取位（引擎 ghostCellAt）+ BoardView CSS transition 滑行（渲染层连续化）
  const elapsed =
    cur.startedAt === null ? 0 : (cur.result ?? cur.nowMs - cur.startedAt);
  const ghostCell =
    ghost !== null ? ghostCellAt(ghost.steps, elapsed, maze.spec.start) : null;

  return (
    <section>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={props.onBack}
          className="rounded border border-white/20 bg-neutral-800 px-3 py-1 text-sm text-white hover:border-white/60"
        >
          ← 返回选图
        </button>
        <h2 className="font-mono text-lg text-white">
          包 {maze.packNo} · 图 {maze.mapIndex}
        </h2>
        <span className="text-xs text-neutral-500">
          WASD/方向键移动 · Esc 放弃
        </span>
      </div>

      <div className="mt-3">
        <Hud run={cur} />
      </div>

      {finish !== null && (
        <div className="mt-3">
          <FinishPanel
            result={finish.result}
            pb={finish.pb}
            beatPb={finish.beatPb}
            onRetry={retry}
            onBack={props.onBack}
          />
          {finish.rejected ? (
            <p className="mt-1 text-xs text-red-400">
              走线认证未通过，本局不入档
            </p>
          ) : (
            finish.degraded && (
              <p className="mt-1 text-xs text-amber-400">
                入档暂不可用（浏览器存储降级），成绩仅本局可见
              </p>
            )
          )}
        </div>
      )}

      <div className="mt-3">
        <BoardView spec={maze.spec} player={cur.cell} ghost={ghostCell} />
      </div>

      <TouchPad onDir={inputDir} />

      <div className="mt-4">
        <GhostPanel ghost={ghost} sealed={sealed} />
      </div>
    </section>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "packs" });

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-6 text-neutral-100">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-xl font-bold tracking-wide text-white">合法幽灵竞速</h1>
        {screen.kind === "packs" && (
          <PackSelect onSelectPack={(packNo) => setScreen({ kind: "mazes", packNo })} />
        )}
        {screen.kind === "mazes" && (
          <MazeScreen
            packNo={screen.packNo}
            onBack={() => setScreen({ kind: "packs" })}
            onSelect={(mapIndex) =>
              setScreen({ kind: "game", packNo: screen.packNo, mapIndex })
            }
          />
        )}
        {screen.kind === "game" && (
          <GameScreen
            packNo={screen.packNo}
            mapIndex={screen.mapIndex}
            onBack={() => setScreen({ kind: "mazes", packNo: screen.packNo })}
          />
        )}
      </div>
    </main>
  );
}
