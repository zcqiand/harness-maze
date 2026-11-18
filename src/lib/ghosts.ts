// 幽灵存档（Task 5）：双键版本化原子写 + 逐条 checksum 校验 + PB 判定 + 旧版封存。
// 分层说明：本模块只管存取完整性——不调用 assertWalkLegal，
// 走线认证在完赛 UI 层（Task 7/8）完成后才落到这里保存。
// 存储面：A/B 双代键 + head 指针（"0"|"1"）。写入永远落在非 head 键上，
// 全部落盘成功才翻 head——中途失败表现为「这一代没存上」，旧代照常可读。

import type { Step } from "./walk";

export const RECORDS_KEY_A = "hmaze.v1.records.0";
export const RECORDS_KEY_B = "hmaze.v1.records.1";
export const RECORDS_HEAD_KEY = "hmaze.v1.records.head"; // "0" | "1"

export interface GhostRecord {
  packNo: number;
  mapIndex: number;
  gridHash: string;
  steps: Step[];
  result: { time: number };
  savedAt: number;
  checksum: string;
}

export function recordKey(packNo: number, mapIndex: number): string {
  return `${packNo}:${mapIndex}`;
}

/** FNV-1a 32 位（offset basis 2166136261，prime 16777619），输出 "fnv1a:<8位hex>"，独立实现不 import map.ts。 */
function fnv1a32(s: string): string {
  let hash = 2166136261;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * stable stringify：手工拼固定键序（packNo,mapIndex,gridHash,steps,result,savedAt），
 * 不依赖 JSON.stringify 的对象键序——调用方对象键序任意，checksum 恒等。
 */
function stableStringify(rec: Omit<GhostRecord, "checksum">): string {
  const steps = rec.steps
    .map((s) => `{"t":${s.t},"cell":{"r":${s.cell.r},"c":${s.cell.c}}}`)
    .join(",");
  return `{"packNo":${rec.packNo},"mapIndex":${rec.mapIndex},"gridHash":${JSON.stringify(rec.gridHash)},"steps":[${steps}],"result":{"time":${rec.result.time}},"savedAt":${rec.savedAt}}`;
}

export function recordChecksum(rec: Omit<GhostRecord, "checksum">): string {
  return fnv1a32(stableStringify(rec));
}

/** 无记录 → true；更快 → true；更慢 / 平局 → false（平局先到先得）。 */
export function isPersonalBest(existing: GhostRecord | undefined, time: number): boolean {
  if (existing === undefined) return true;
  return time < existing.result.time;
}

// ---------- 读取侧（全部非抛：坏数据弃条/弃代，绝不白屏） ----------

function readKey(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** 形状守卫 + checksum 复算；坏一条弃一条。多余字段丢弃，按守卫过的字段重建。 */
function parseRecord(v: unknown): GhostRecord | null {
  if (v === null || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!isFiniteNum(o.packNo) || !isFiniteNum(o.mapIndex) || typeof o.gridHash !== "string") return null;
  if (typeof o.savedAt !== "number" || !Number.isFinite(o.savedAt)) return null;
  const result = o.result;
  if (result === null || typeof result !== "object") return null;
  const time = (result as Record<string, unknown>).time;
  if (!isFiniteNum(time)) return null;
  if (typeof o.checksum !== "string") return null;
  if (!Array.isArray(o.steps)) return null;

  const steps: Step[] = [];
  for (const s of o.steps) {
    if (s === null || typeof s !== "object") return null;
    const so = s as Record<string, unknown>;
    const cell = so.cell;
    if (cell === null || typeof cell !== "object") return null;
    const co = cell as Record<string, unknown>;
    if (!isFiniteNum(so.t) || !isFiniteNum(co.r) || !isFiniteNum(co.c)) return null;
    steps.push({ t: so.t, cell: { r: co.r, c: co.c } });
  }

  const rec: GhostRecord = {
    packNo: o.packNo,
    mapIndex: o.mapIndex,
    gridHash: o.gridHash,
    steps,
    result: { time },
    savedAt: o.savedAt,
    checksum: o.checksum,
  };
  const { checksum, ...rest } = rec;
  if (recordChecksum(rest) !== checksum) return null;
  return rec;
}

/** 一代快照 = { recordKey: GhostRecord }；JSON 坏 / 形状坏 → null（整代作废）。 */
function parsePayload(raw: string | null): Map<string, GhostRecord> | null {
  if (raw === null) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return null;
  const out = new Map<string, GhostRecord>();
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const rec = parseRecord(v);
    if (rec !== null) out.set(k, rec);
  }
  return out;
}

/**
 * 读 head 键 → 主键；主键坏/缺失 → 回落另一键；双坏返回空 Map。
 * head 值垃圾按 "0" 归一化（主键 A，回落 B）。
 */
export function loadRecords(storage: Storage): Map<string, GhostRecord> {
  const headRaw = readKey(storage, RECORDS_HEAD_KEY);
  const head = headRaw === "1" ? "1" : "0";
  const primary = head === "0" ? RECORDS_KEY_A : RECORDS_KEY_B;
  const fallback = head === "0" ? RECORDS_KEY_B : RECORDS_KEY_A;

  const primaryPayload = parsePayload(readKey(storage, primary));
  if (primaryPayload !== null) return primaryPayload;
  return parsePayload(readKey(storage, fallback)) ?? new Map<string, GhostRecord>();
}

// ---------- 写入侧 ----------

/** 计 checksum+savedAt；已有 PB 更快才覆盖（平局先到先得）；双键原子写，任一步失败静默降级不抛。 */
export function saveGhost(
  storage: Storage,
  rec: Omit<GhostRecord, "checksum" | "savedAt">,
  nowMs: number,
): GhostRecord {
  const full: GhostRecord = { ...rec, savedAt: nowMs, checksum: "" };
  full.checksum = recordChecksum(full);

  // PB 闸：loadRecords 非抛，坏档视同无记录（可覆盖）
  const key = recordKey(rec.packNo, rec.mapIndex);
  const existing = loadRecords(storage).get(key);
  if (!isPersonalBest(existing, rec.result.time)) {
    return existing!; // 更慢 / 平局：先到先得，现存不动
  }

  // 双键版本化原子写：写非 head 键 → 翻 head；任一步 try/catch 静默降级
  try {
    const headRaw = readKey(storage, RECORDS_HEAD_KEY);
    const head = headRaw === "1" ? "1" : "0";
    const nextKey = head === "0" ? RECORDS_KEY_B : RECORDS_KEY_A;
    const nextHead = head === "0" ? "1" : "0";

    // 新代 = 现役 head 代全量复制 + 本条改写（非 head 键上是上上代，不能作底）
    const nextPayload = loadRecords(storage);
    nextPayload.set(key, full);

    const obj: Record<string, GhostRecord> = {};
    for (const [k, v] of nextPayload) obj[k] = v;
    storage.setItem(nextKey, JSON.stringify(obj));
    storage.setItem(RECORDS_HEAD_KEY, nextHead);
  } catch {
    // 静默降级：写入失败不抛不白屏；head 未翻则本次成绩只在本会话内存可见
  }
  return full;
}

// ---------- 比对侧 ----------

export function compareGhost(
  records: Map<string, GhostRecord>,
  packNo: number,
  mapIndex: number,
  currentHash: string,
): { ghost: GhostRecord | null; sealed: GhostRecord | null } {
  const rec = records.get(recordKey(packNo, mapIndex));
  if (rec === undefined) return { ghost: null, sealed: null };
  // gridHash 相等 → 可赛幽灵；不等 → 旧版封存（成绩册可见、不可赛，裁定 10）
  if (rec.gridHash === currentHash) return { ghost: rec, sealed: null };
  return { ghost: null, sealed: rec };
}
