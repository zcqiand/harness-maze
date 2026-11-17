# harness-maze — 仓库工作约定（供 Claude Code）

本仓为书《Harness 工程：Codex 智能游戏开发入门》（xr-know-022）配套仓，
是书稿代码块的 **source of truth**。绑定章节：ch9（迷宫探险）、ch16（程序化关卡生成 v2）。

## 项目定位

Godot 迷宫探险游戏：ch9 落结构化地图规约（JSON 地图契约）+寻路断言+存档校验；ch16 v2 落程序化关卡生成器（难度规约+种子复现+无效关卡自检）。

## 铁律

- **版本钉死**：Godot 版本以 `version-lock.json` 为准（ch4 安装实测后回填实测回执）；不引入 lock 外的插件
- **TDD**：寻路/地图解析/存档校验等纯逻辑先写断言脚本 → 确认失败 → 实现 → 确认绿 → commit（headless 跑，无 Key 无网）
- **地图契约化**：地图必须从 `data/levels/` JSON 加载，禁止硬编码到 GDScript；存档写入先临时文件再替换（原子性）
- **零伪代码**：禁止 `pass`/`TODO` 占位，每段代码必须可运行
- **只增不改**：随章节扩仓不动现有模块签名/行为

## 验收

```bash
godot --headless --path . --quit   # 工程可被 Godot 正常导入解析（ch4 Godot 装机后启用）
```

GDScript 侧断言脚本随 ch9 章节落（headless 场景跑断言）。本机无 Godot 时，工程结构以 ch4 实测为准补验。

## 正式区 / 临时区（2026-10-24 人定，全产品线通用）

- 过程件（关卡实验、种子实验记录、调试日志）进 `_work/`，不与正式件混放
- 正式区同名正式件有且仅有一个；`_work/` 整目录 .gitignore；`.godot/` 为可再生件，gitignore

## 细则（docs/conventions/，按需引用）

- 目录结构与章节绑定 → `docs/conventions/structure.md`
- Tag 规约：Release 格式 `v<MAJOR>.<MINOR>.<PATCH>-<YYYYMMDD>`，禁止删/覆盖，禁止 `git push --tags` → `docs/conventions/tagging.md`
