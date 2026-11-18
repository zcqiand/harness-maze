# harness-maze — 仓库工作约定（供 Claude Code）

本仓为书《Harness 工程：Codex 智能游戏开发入门》（xr-know-022）配套仓，
是书稿代码块的 **source of truth**。绑定章节：ch9（迷宫探险）、ch16（程序化关卡生成 v2）。

## 项目定位

合法幽灵竞速迷宫（React + TypeScript H5）：ch9 落结构化地图规约（JSON 地图契约）+寻路断言+存档校验；ch16 v2 落程序化关卡生成器（难度规约+种子复现+无效关卡自检）。

## 铁律

- **版本钉死**：依赖与 `version-lock.json` 的 `version_lock` 一致；不引入 lock 外的库；npm 一律走 `registry.npmmirror.com`
- **TDD**：寻路/地图解析/存档校验等纯逻辑先写失败测试 → 确认失败 → 实现 → 确认绿 → commit；`npm test` 无 Key、无网全绿
- **地图契约化**：地图必须从 `data/levels/` JSON 加载，禁止硬编码到组件逻辑
- **存档原子性**：存档写入用双键版本化切换（新键写成功后再翻转读键），禁止半写状态
- **零伪代码**：禁止 `TODO`/`...` 占位，每段代码必须可运行
- **只增不改**：随章节扩仓不动现有模块签名/行为

## 验收

```bash
npm install --registry=https://registry.npmmirror.com
npm run build    # tsc strict + vite 构建门
npm test         # vitest 断言门
```

## 正式区 / 临时区（2026-10-24 人定，全产品线通用）

- 过程件（关卡实验、种子实验记录、调试日志）进 `_work/`，不与正式件混放
- 正式区同名正式件有且仅有一个；`_work/` 整目录 .gitignore；`dist/`、`node_modules/` 为可再生件，gitignore

## 细则（docs/conventions/，按需引用）

- 目录结构与章节绑定 → `docs/conventions/structure.md`
- Tag 规约：Release 格式 `v<MAJOR>.<MINOR>.<PATCH>-<YYYYMMDD>`，禁止删/覆盖，禁止 `git push --tags` → `docs/conventions/tagging.md`
