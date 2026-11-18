import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage, safeLocalStorage } from "./storage";

// vitest 跑在 node 环境，宿主 localStorage 存在与与否不可依赖（pre-flight 裁定）：
// 两分支均用 stub 造——一例正常 Storage 假件、一例 getter 抛错的 Cookie 阻断形态。
const PROBE_KEY = "__hmaze_probe__";

function makeWorkingFakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    key: (i) => {
      const keys = [...map.keys()];
      return i >= 0 && i < keys.length ? keys[i]! : null;
    },
    removeItem: (k) => map.delete(k),
    setItem: (k, v) => map.set(k, v),
  };
}

const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalDescriptor);
  } else {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});

describe("safeLocalStorage", () => {
  it("真件探活成功：返回同域真件本身（setItem+removeItem 回环通过）", () => {
    const fake = makeWorkingFakeStorage();
    vi.stubGlobal("localStorage", fake);
    expect(safeLocalStorage()).toBe(fake);
    // 探活不留痕
    expect(fake.getItem(PROBE_KEY)).toBeNull();
  });

  it("真件探活失败（setItem 抛错）：静默降级返回 MemoryStorage，不抛", () => {
    const hostile: Storage = Object.assign(makeWorkingFakeStorage(), {
      setItem: () => {
        throw new Error("quota exceeded");
      },
    });
    vi.stubGlobal("localStorage", hostile);
    const s = safeLocalStorage();
    expect(s).toBeInstanceOf(MemoryStorage);
    // 不把探活键污染到假件上
    expect(hostile.getItem(PROBE_KEY)).toBeNull();
  });

  it("真件探活失败（removeItem 抛错）：静默降级返回 MemoryStorage，不抛", () => {
    const hostile: Storage = Object.assign(makeWorkingFakeStorage(), {
      removeItem: () => {
        throw new Error("access denied");
      },
    });
    vi.stubGlobal("localStorage", hostile);
    expect(safeLocalStorage()).toBeInstanceOf(MemoryStorage);
  });

  it("Cookie 阻断（getter 抛 SecurityError 形状 Error）：返回 MemoryStorage 且不抛", () => {
    // 模拟浏览器禁 Cookie 时访问 localStorage getter 即抛的形态
    Object.defineProperty(globalThis, "localStorage", {
      get() {
        throw new Error("SecurityError: The document is cookie-disabled");
      },
      configurable: true,
    });
    const s = safeLocalStorage();
    expect(s).toBeInstanceOf(MemoryStorage);
    // 降级件可用：setItem/getItem 回环
    s.setItem("k", "v");
    expect(s.getItem("k")).toBe("v");
  });

  it("阻断降级为模块级单例：多次调用返回同一实例", () => {
    Object.defineProperty(globalThis, "localStorage", {
      get() {
        throw new Error("SecurityError");
      },
      configurable: true,
    });
    const a = safeLocalStorage();
    const b = safeLocalStorage();
    expect(b).toBe(a);
    // 两实例共享同一底层数据（单例语义）
    b.setItem("shared", "yes");
    expect(a.getItem("shared")).toBe("yes");
  });
});

describe("MemoryStorage 六成员", () => {
  it("初始态：length 0 / getItem null / key null", () => {
    const s = new MemoryStorage();
    expect(s.length).toBe(0);
    expect(s.getItem("missing")).toBeNull();
    expect(s.key(0)).toBeNull();
  });

  it("setItem/getItem/length/key 基本回环", () => {
    const s = new MemoryStorage();
    s.setItem("a", "1");
    s.setItem("b", "2");
    expect(s.getItem("a")).toBe("1");
    expect(s.getItem("b")).toBe("2");
    expect(s.length).toBe(2);
    expect(s.key(0)).toBe("a");
    expect(s.key(1)).toBe("b");
    expect(s.key(2)).toBeNull();
    expect(s.key(-1)).toBeNull();
  });

  it("setItem 同键覆盖：不增 length、key 序不变", () => {
    const s = new MemoryStorage();
    s.setItem("a", "1");
    s.setItem("a", "1x");
    expect(s.length).toBe(1);
    expect(s.getItem("a")).toBe("1x");
    expect(s.key(0)).toBe("a");
  });

  it("removeItem：删后 getItem null、length 归位", () => {
    const s = new MemoryStorage();
    s.setItem("a", "1");
    s.setItem("b", "2");
    s.removeItem("a");
    expect(s.getItem("a")).toBeNull();
    expect(s.length).toBe(1);
    expect(s.key(0)).toBe("b");
    // 删不存在的键不抛
    expect(() => s.removeItem("ghost")).not.toThrow();
  });

  it("removeItem 后同键重设：追加到末尾（key 序语义）", () => {
    const s = new MemoryStorage();
    s.setItem("a", "1");
    s.setItem("b", "2");
    s.removeItem("a");
    s.setItem("a", "1z");
    expect(s.key(0)).toBe("b");
    expect(s.key(1)).toBe("a");
  });

  it("clear：length 归 0，全键清空", () => {
    const s = new MemoryStorage();
    s.setItem("a", "1");
    s.setItem("b", "2");
    s.clear();
    expect(s.length).toBe(0);
    expect(s.getItem("a")).toBeNull();
    expect(s.getItem("b")).toBeNull();
    expect(s.key(0)).toBeNull();
  });

  it("单例内部隔离：new 出的实例与 safeLocalStorage 降级单例互不相通", () => {
    Object.defineProperty(globalThis, "localStorage", {
      get() {
        throw new Error("SecurityError");
      },
      configurable: true,
    });
    const singleton = safeLocalStorage();
    const fresh = new MemoryStorage();
    singleton.setItem("only", "singleton");
    expect(fresh.getItem("only")).toBeNull();
  });
});
