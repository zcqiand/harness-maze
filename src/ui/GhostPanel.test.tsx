// Task 7 UI 测试：GhostPanel 三态（红→绿）+ PackSelect/MazeSelect 静态渲染冒烟。
// 全部 renderToStaticMarkup（react-dom/server），零新增依赖，不碰真实 localStorage。

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { formatMs, GhostPanel } from "./GhostPanel";
import { PackSelect } from "./PackSelect";
import { MazeSelect, type MazeCardVM } from "./MazeSelect";
import { recordChecksum, type GhostRecord } from "../lib/ghosts";

/** 用 recordChecksum 造一条 checksum 自洽的 GhostRecord（面板是纯渲染，不校验也不依赖） */
function makeRecord(over: Partial<GhostRecord> = {}): GhostRecord {
  const base = {
    packNo: 1,
    mapIndex: 0,
    gridHash: "fnv1a:00000000",
    steps: [],
    result: { time: 12340 },
    savedAt: 1000,
    ...over,
  };
  return { ...base, checksum: recordChecksum(base) };
}

describe("formatMs", () => {
  it("秒.三位毫秒形状", () => {
    expect(formatMs(12340)).toBe("12.340");
    expect(formatMs(0)).toBe("0.000");
    expect(formatMs(1234)).toBe("1.234");
    expect(formatMs(59999)).toBe("59.999");
  });
});

describe("GhostPanel 三态", () => {
  it("ghost 在位：含最佳时间与「幽灵在位」，不含「旧版封存」", () => {
    const html = renderToStaticMarkup(
      <GhostPanel ghost={makeRecord({ result: { time: 12340 } })} sealed={null} />,
    );
    expect(html).toContain("12.340");
    expect(html).toContain("幽灵在位");
    expect(html).not.toContain("旧版封存");
  });

  it("sealed 封存：含「旧版封存」，不含「幽灵在位」", () => {
    const html = renderToStaticMarkup(
      <GhostPanel ghost={null} sealed={makeRecord({ gridHash: "fnv1a:deadbeef" })} />,
    );
    expect(html).toContain("旧版封存");
    expect(html).not.toContain("幽灵在位");
  });

  it("双 null：含「暂无幽灵」", () => {
    const html = renderToStaticMarkup(<GhostPanel ghost={null} sealed={null} />);
    expect(html).toContain("暂无幽灵");
  });
});

describe("PackSelect 静态渲染冒烟", () => {
  it("包号 1..5 直列全渲染", () => {
    const html = renderToStaticMarkup(<PackSelect onSelectPack={() => {}} />);
    for (const n of [1, 2, 3, 4, 5]) {
      expect(html).toContain(`包 ${n}`);
    }
    expect(html).toContain("自定义");
  });
});

describe("MazeSelect 静态渲染冒烟", () => {
  const cards: MazeCardVM[] = [
    { mapIndex: 0, name: "p1-m0", size: 11, bestMs: 12340, ghostInPlace: true, sealed: false },
    { mapIndex: 1, name: "p1-m1", size: 11, bestMs: 8000, ghostInPlace: false, sealed: true },
    { mapIndex: 2, name: "p1-m2", size: 11, bestMs: null, ghostInPlace: false, sealed: false },
  ];

  it("名称+尺寸+最佳时间+幽灵在位标记全渲染", () => {
    const html = renderToStaticMarkup(<MazeSelect mazes={cards} onSelect={() => {}} />);
    expect(html).toContain("p1-m0");
    expect(html).toContain("11×11");
    expect(html).toContain("12.340");
    expect(html).toContain("幽灵在位");
  });

  it("sealed 卡片标「旧版」并禁点（disabled）", () => {
    const html = renderToStaticMarkup(<MazeSelect mazes={cards} onSelect={() => {}} />);
    expect(html).toContain("旧版");
    expect(html).toContain("disabled");
  });

  it("无记录卡片最佳时间显示占位「—」", () => {
    const html = renderToStaticMarkup(<MazeSelect mazes={cards} onSelect={() => {}} />);
    expect(html).toContain("—");
  });
});
