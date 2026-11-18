import { describe, expect, it } from "vitest";
import { MemoryStorage } from "./storage";
import {
  RECORDS_HEAD_KEY,
  RECORDS_KEY_A,
  RECORDS_KEY_B,
  compareGhost,
  isPersonalBest,
  loadRecords,
  recordChecksum,
  recordKey,
  saveGhost,
  type GhostRecord,
} from "./ghosts";
import type { Step } from "./walk";

function stepsOf(...pairs: [number, number, number][]): Step[] {
  return pairs.map(([t, r, c]) => ({ t, cell: { r, c } }));
}

const baseRec = (): Omit<GhostRecord, "checksum" | "savedAt"> => ({
  packNo: 1,
  mapIndex: 0,
  gridHash: "fnv1a:deadbeef",
  steps: stepsOf([0, 1, 1], [120, 1, 2], [300, 1, 3]),
  result: { time: 300 },
});

const otherMapRec = (): Omit<GhostRecord, "checksum" | "savedAt"> => ({
  packNo: 1,
  mapIndex: 1,
  gridHash: "fnv1a:cafe0000",
  steps: stepsOf([0, 2, 1], [90, 2, 2], [450, 2, 3]),
  result: { time: 450 },
});

describe("recordKey / recordChecksum 基本形状", () => {
  it("recordKey = packNo:mapIndex", () => {
    expect(recordKey(1, 0)).toBe("1:0");
    expect(recordKey(3, 12)).toBe("3:12");
  });

  it("checksum 形如 fnv1a:<8位hex>，同内容稳定、异内容不同", () => {
    const a = recordChecksum({ ...baseRec(), savedAt: 1000 });
    expect(a).toMatch(/^fnv1a:[0-9a-f]{8}$/);
    expect(recordChecksum({ ...baseRec(), savedAt: 1000 })).toBe(a);
    expect(recordChecksum({ ...baseRec(), savedAt: 1001 })).not.toBe(a);
    // stable stringify 不依赖调用方对象键序
    const shuffled = {
      result: baseRec().result,
      steps: baseRec().steps,
      gridHash: baseRec().gridHash,
      mapIndex: baseRec().mapIndex,
      packNo: baseRec().packNo,
      savedAt: 1000,
    };
    expect(recordChecksum(shuffled)).toBe(a);
  });
});

describe("saveGhost / loadRecords", () => {
  it("① save 后 load 全等回读，checksum 与 savedAt 落位", () => {
    const s = new MemoryStorage();
    const saved = saveGhost(s, baseRec(), 1000);
    expect(saved.savedAt).toBe(1000);
    expect(saved.checksum).toMatch(/^fnv1a:[0-9a-f]{8}$/);

    const loaded = loadRecords(s);
    const got = loaded.get(recordKey(1, 0));
    expect(got).toEqual(saved);
    // 回读 checksum 可由其余字段独立复算
    const { checksum, ...rest } = got!;
    expect(recordChecksum(rest)).toBe(checksum);
  });

  it("双键版本化：新代写非 head 键再翻 head（首代→B/head1，次代→A/head0）", () => {
    const s = new MemoryStorage();
    saveGhost(s, baseRec(), 1000);
    expect(s.getItem(RECORDS_HEAD_KEY)).toBe("1");
    expect(s.getItem(RECORDS_KEY_B)).not.toBeNull();

    saveGhost(s, otherMapRec(), 2000);
    expect(s.getItem(RECORDS_HEAD_KEY)).toBe("0");
    // 新代（A）含两条；旧代（B）仍是单条快照
    expect(Object.keys(JSON.parse(s.getItem(RECORDS_KEY_A)!))).toHaveLength(2);
    expect(Object.keys(JSON.parse(s.getItem(RECORDS_KEY_B)!))).toHaveLength(1);
  });

  it("② 篡改现役键序列化串一字符：该条被弃、另一条完好不连坐", () => {
    const s = new MemoryStorage();
    saveGhost(s, baseRec(), 1000);
    saveGhost(s, otherMapRec(), 2000);

    // 现役键 A：把 rec(1,0) 的 "time":300 改成 301（JSON 仍合法，checksum 失配）
    const raw = s.getItem(RECORDS_KEY_A)!;
    expect(raw).toContain('"time":300');
    s.setItem(RECORDS_KEY_A, raw.replace('"time":300', '"time":301'));

    const loaded = loadRecords(s);
    expect(loaded.size).toBe(1);
    expect(loaded.has(recordKey(1, 0))).toBe(false);
    const kept = loaded.get(recordKey(1, 1))!;
    expect(kept.result.time).toBe(450);
  });

  it("③ head 所指键坏 JSON：回落另一键旧快照（第一代单条）", () => {
    const s = new MemoryStorage();
    saveGhost(s, baseRec(), 1000); // 代1 → B
    saveGhost(s, otherMapRec(), 2000); // 代2 → A，head→0

    s.setItem(RECORDS_KEY_A, "{broken json");

    const loaded = loadRecords(s);
    expect(loaded.size).toBe(1);
    expect(loaded.get(recordKey(1, 0))!.savedAt).toBe(1000);
  });

  it("③b head 键值垃圾：归一化主键 A 不丢现役数据", () => {
    const s = new MemoryStorage();
    saveGhost(s, baseRec(), 1000);
    saveGhost(s, otherMapRec(), 2000);
    s.setItem(RECORDS_HEAD_KEY, "bogus");

    const loaded = loadRecords(s);
    expect(loaded.size).toBe(2);
  });

  it("④ 双键全坏：返回空 Map，不抛", () => {
    const s = new MemoryStorage();
    s.setItem(RECORDS_KEY_A, "not json at all");
    s.setItem(RECORDS_KEY_B, "]]]");
    s.setItem(RECORDS_HEAD_KEY, "1");
    expect(() => loadRecords(s)).not.toThrow();
    expect(loadRecords(s).size).toBe(0);
  });

  it("④b 空仓：空 Map 不抛", () => {
    expect(loadRecords(new MemoryStorage()).size).toBe(0);
  });

  it("⑦ saveGhost 慢于现存：先到先得，现存不动（savedAt 不变）", () => {
    const s = new MemoryStorage();
    saveGhost(s, baseRec(), 1000);
    const slower = saveGhost(s, { ...baseRec(), result: { time: 400 } }, 2000);
    // 返回现存（先到者），非新记录
    expect(slower.savedAt).toBe(1000);
    expect(slower.result.time).toBe(300);

    const loaded = loadRecords(s).get(recordKey(1, 0))!;
    expect(loaded.result.time).toBe(300);
    expect(loaded.savedAt).toBe(1000);
  });

  it("⑦b saveGhost 快于现存：覆盖（新 time + 新 savedAt）", () => {
    const s = new MemoryStorage();
    saveGhost(s, baseRec(), 1000);
    const faster = saveGhost(s, { ...baseRec(), result: { time: 200 } }, 3000);
    expect(faster.result.time).toBe(200);
    expect(faster.savedAt).toBe(3000);

    const loaded = loadRecords(s).get(recordKey(1, 0))!;
    expect(loaded.result.time).toBe(200);
    expect(loaded.savedAt).toBe(3000);
  });

  it("⑧ 非法走线不经此处拦：空 steps / 越界 cell 均照存（认证在完赛 UI 层，分层）", () => {
    const s = new MemoryStorage();
    expect(() => saveGhost(s, { ...baseRec(), steps: [], result: { time: 0 } }, 1000)).not.toThrow();
    expect(() =>
      saveGhost(s, { ...baseRec(), mapIndex: 2, steps: stepsOf([0, 99, 99]) }, 1100),
    ).not.toThrow();
    expect(loadRecords(s).size).toBe(2);
  });
});

describe("isPersonalBest", () => {
  const existing: GhostRecord = {
    ...baseRec(),
    savedAt: 1000,
    checksum: recordChecksum({ ...baseRec(), savedAt: 1000 }),
  };

  it("无记录 → true", () => {
    expect(isPersonalBest(undefined, 999)).toBe(true);
  });
  it("更快 → true", () => {
    expect(isPersonalBest(existing, 299)).toBe(true);
  });
  it("更慢 → false", () => {
    expect(isPersonalBest(existing, 400)).toBe(false);
  });
  it("平局 → false（先到先得）", () => {
    expect(isPersonalBest(existing, 300)).toBe(false);
  });
});

describe("compareGhost", () => {
  const makeMap = (hash: string): Map<string, GhostRecord> => {
    const s = new MemoryStorage();
    saveGhost(s, { ...baseRec(), gridHash: hash }, 1000);
    return loadRecords(s);
  };

  it("gridHash 相等 → ghost", () => {
    const { ghost, sealed } = compareGhost(makeMap("fnv1a:11111111"), 1, 0, "fnv1a:11111111");
    expect(ghost).not.toBeNull();
    expect(ghost!.result.time).toBe(300);
    expect(sealed).toBeNull();
  });

  it("gridHash 不等 → sealed（旧版封存：成绩册可见、不可赛）", () => {
    const { ghost, sealed } = compareGhost(makeMap("fnv1a:22222222"), 1, 0, "fnv1a:33333333");
    expect(ghost).toBeNull();
    expect(sealed).not.toBeNull();
    expect(sealed!.gridHash).toBe("fnv1a:22222222");
  });

  it("无记录 → 双 null", () => {
    const records = makeMap("fnv1a:44444444");
    const { ghost, sealed } = compareGhost(records, 9, 9, "fnv1a:44444444");
    expect(ghost).toBeNull();
    expect(sealed).toBeNull();
  });
});
