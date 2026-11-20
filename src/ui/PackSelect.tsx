// 选包屏（纯渲染）：包号 1..5 直列 + 自定义输入框。
// 自定义输入经 isValidPackNo 守卫——非法回落不动（裁定 14）：不抛错、不跳转，玩家原地改。 @impl M04.F02.I01
// 不碰 storage / generator，包号选择只经 onSelectPack 回调出（App 注入）。

import { useState } from "react";
import type { JSX, FormEvent } from "react";
import { isValidPackNo } from "../lib/generator";

const PACK_LIST = [1, 2, 3, 4, 5];

export function PackSelect(props: {
  onSelectPack: (packNo: number) => void;
}): JSX.Element {
  const [custom, setCustom] = useState("");

  const submitCustom = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(custom.trim());
    if (isValidPackNo(n)) {
      props.onSelectPack(n);
    }
    // 非法回落不动：状态不变、不导航、不报错
  };

  return (
    <section>
      <h2 className="text-sm font-semibold tracking-widest text-neutral-400 uppercase">选包</h2>
      <div className="mt-3 flex flex-wrap gap-3">
        {PACK_LIST.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => props.onSelectPack(n)}
            className="min-w-24 rounded-lg border-2 border-white/15 bg-neutral-900 px-4 py-3 text-left text-white transition-colors hover:border-white/60 hover:bg-neutral-800"
          >
            <span className="block font-mono text-xl">包 {n}</span>
            <span className="block text-xs text-neutral-500">标准包</span>
          </button>
        ))}
      </div>
      <form onSubmit={submitCustom} className="mt-4 flex items-center gap-2">
        <label htmlFor="custom-pack" className="text-xs text-neutral-400">
          自定义包号
        </label>
        <input
          id="custom-pack"
          type="text"
          inputMode="numeric"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="≥1 的整数"
          className="w-32 rounded border border-white/20 bg-neutral-900 px-2 py-1 font-mono text-sm text-white placeholder-neutral-600 focus:border-white/60 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded border border-white/20 bg-neutral-800 px-3 py-1 text-sm text-white hover:border-white/60"
        >
          进入
        </button>
      </form>
    </section>
  );
}
