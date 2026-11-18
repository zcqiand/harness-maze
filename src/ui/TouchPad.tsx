// 触屏四向（Task 8，纯渲染）：四向按钮挂 data-fn="dpad-up|down|left|right"
//（面向用户功能触发元素挂 data-fn 的仓纪律），方向经 onDir 回调出。

import type { JSX } from "react";
import type { Dir } from "../lib/engine";

const BTN_CLASS =
  "rounded-lg border border-white/20 bg-neutral-800 text-xl text-white active:bg-neutral-700";

export function TouchPad(props: { onDir: (dir: Dir) => void }): JSX.Element {
  const btn = (dir: Dir, label: string, fn: string, extra = ""): JSX.Element => (
    <button
      key={dir}
      type="button"
      data-fn={fn}
      aria-label={`向${label}走`}
      onClick={() => props.onDir(dir)}
      className={`${BTN_CLASS} ${extra}`}
    >
      {label}
    </button>
  );

  return (
    <div
      className="mx-auto mt-4 grid w-44 grid-cols-3 grid-rows-2 gap-2"
      aria-label="触屏方向键"
    >
      {btn("up", "上", "dpad-up", "col-start-2")}
      {btn("left", "左", "dpad-left")}
      {btn("down", "下", "dpad-down")}
      {btn("right", "右", "dpad-right")}
    </div>
  );
}
