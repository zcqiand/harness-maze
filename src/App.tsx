// 顶层路由（Task 7 定形，Task 8 只加 game 态实装）：packs → mazes → game。
// App 是唯一接 storage/generator 的地方：generatePack 产包、loadRecords+compareGhost
// 判每张图的幽灵在位/旧版封存，算成 MazeCardVM 注入纯渲染组件。
// game 态本任务先落占位（Task 8 接竞速局）。

import { useMemo, useState } from "react";
import type { JSX } from "react";
import { generatePack, packSize } from "./lib/generator";
import { gridHash } from "./lib/map";
import { compareGhost, loadRecords, type GhostRecord } from "./lib/ghosts";
import { safeLocalStorage } from "./lib/storage";
import { PackSelect } from "./ui/PackSelect";
import { MazeSelect, type MazeCardVM } from "./ui/MazeSelect";
import { GhostPanel } from "./ui/GhostPanel";

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

function GamePlaceholder(props: { packNo: number; mapIndex: number; onBack: () => void }): JSX.Element {
  // 占位：竞速局实装归 Task 8；成绩册面板先接上（同一 loadRecords+compareGhost 数据面）
  const [ghost, sealed] = useMemo<[GhostRecord | null, GhostRecord | null]>(() => {
    const [m] = generatePack(props.packNo).filter((x) => x.mapIndex === props.mapIndex);
    if (m === undefined) return [null, null];
    const records = loadRecords(safeLocalStorage());
    const r = compareGhost(records, m.packNo, m.mapIndex, gridHash(m.spec.grid));
    return [r.ghost, r.sealed];
  }, [props.packNo, props.mapIndex]);

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
          包 {props.packNo} · 图 {props.mapIndex}
        </h2>
      </div>
      <p className="mt-4 text-sm text-neutral-500">竞速局 Task 8 接线。</p>
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
          <GamePlaceholder
            packNo={screen.packNo}
            mapIndex={screen.mapIndex}
            onBack={() => setScreen({ kind: "mazes", packNo: screen.packNo })}
          />
        )}
      </div>
    </main>
  );
}
