// 存储底座（Task 5）：safeLocalStorage 探活 + 内存回退假件。
// 浏览器禁 Cookie / 隐私模式 / 配额异常时访问 localStorage 可能抛错——
// 这里用 setItem+removeItem 回环探活，成功用真件，任何一步失败静默降级
// 到模块级 MemoryStorage 单例（游戏成绩不丢会话内进度，不白屏）。

/** DOM Storage 的内存实现，六成员齐全；键序 = 插入序（同键覆盖不换位）。 */
export class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  key(index: number): string | null {
    const keys = [...this.map.keys()];
    return index >= 0 && index < keys.length ? keys[index]! : null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

// 模块级单例：整个会话所有降级调用方共享同一块内存存储。
let mem: MemoryStorage | null = null;

function memoryStorage(): MemoryStorage {
  if (mem === null) {
    mem = new MemoryStorage();
  }
  return mem;
}

const PROBE_KEY = "__hmaze_probe__";

/** try globalThis.localStorage 探活（setItem+removeItem 回环）；成功返回真件，否则 MemoryStorage 单例。 @impl M03.F01.I01 */
export function safeLocalStorage(): Storage {
  try {
    const s = (globalThis as { localStorage?: Storage | null }).localStorage;
    if (s === undefined || s === null) {
      throw new Error("localStorage unavailable");
    }
    s.setItem(PROBE_KEY, "1");
    s.removeItem(PROBE_KEY);
    return s;
  } catch {
    return memoryStorage();
  }
}
