import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import App from "./App";

describe("App 骨架", () => {
  it("渲染占位标题", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("合法幽灵竞速");
  });
});
