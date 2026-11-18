import { describe, it, expect } from "vitest";
import {
  MAPS_PER_PACK,
  isValidPackNo,
  packSize,
  generatePack,
} from "./generator";
import { validateMapSpec, bfsSolvable } from "./map";

describe("isValidPackNo", () => {
  it("1/2/19 为真", () => {
    expect(isValidPackNo(1)).toBe(true);
    expect(isValidPackNo(2)).toBe(true);
    expect(isValidPackNo(19)).toBe(true);
  });

  it("0/-1/1.5/NaN/Infinity 为假", () => {
    expect(isValidPackNo(0)).toBe(false);
    expect(isValidPackNo(-1)).toBe(false);
    expect(isValidPackNo(1.5)).toBe(false);
    expect(isValidPackNo(NaN)).toBe(false);
    expect(isValidPackNo(Infinity)).toBe(false);
  });
});

describe("packSize", () => {
  it("pack1=11、pack4=17、pack5=19、pack99=19（11→19 封顶）", () => {
    expect(packSize(1)).toBe(11);
    expect(packSize(4)).toBe(17);
    expect(packSize(5)).toBe(19);
    expect(packSize(99)).toBe(19);
  });
});

describe("generatePack(1)", () => {
  const pack = generatePack(1);

  it("长度 = MAPS_PER_PACK = 5", () => {
    expect(MAPS_PER_PACK).toBe(5);
    expect(pack.length).toBe(5);
  });

  it("每张 validateMapSpec === null 且 bfsSolvable === true", () => {
    for (const maze of pack) {
      expect(validateMapSpec(maze.spec)).toBeNull();
      expect(bfsSolvable(maze.spec)).toBe(true);
    }
  });

  it("尺寸 = 11（pack1），start/goal 在四角内缩位", () => {
    for (const maze of pack) {
      expect(maze.spec.grid.length).toBe(11);
      for (const row of maze.spec.grid) expect(row.length).toBe(11);
      expect(maze.spec.start).toEqual({ r: 1, c: 1 });
      expect(maze.spec.goal).toEqual({ r: 9, c: 9 });
    }
  });

  it("spec.name 形如 p1-m0…p1-m4，packNo/mapIndex 对齐", () => {
    pack.forEach((maze, i) => {
      expect(maze.packNo).toBe(1);
      expect(maze.mapIndex).toBe(i);
      expect(maze.spec.name).toBe(`p1-m${i}`);
    });
  });
});

describe("确定性", () => {
  it("generatePack(3) 两次调用 JSON.stringify 全等", () => {
    const a = generatePack(3);
    const b = generatePack(3);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("generatePack(3) ≠ generatePack(4)", () => {
    expect(JSON.stringify(generatePack(3))).not.toBe(
      JSON.stringify(generatePack(4)),
    );
  });
});

describe("非法包号", () => {
  it("generatePack(0) 抛 RangeError", () => {
    expect(() => generatePack(0)).toThrow(RangeError);
  });

  it("generatePack(1.5) 抛 RangeError", () => {
    expect(() => generatePack(1.5)).toThrow(RangeError);
  });
});
