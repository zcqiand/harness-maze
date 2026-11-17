# 目录结构与章节绑定

> 树是文件系统的复写，以仓库实际为准；模块职责与章节绑定在此维护。

```text
harness-maze/
├── CLAUDE.md                       ← 工程约定入口
├── version-lock.json               ← 版本钉死 SSOT（Godot 版本）
├── project.godot                   ← Godot 工程描述（config_version=5）
├── scenes/
│   └── main.tscn                   ← 主场景：迷宫渲染根
├── scripts/
│   └── main.gd                     ← 主场景脚本：加载关卡 JSON 并校验
├── data/
│   └── levels/
│       └── level_001.json          ← 地图契约样例（结构化地图规约载体）
├── docs/conventions/               ← structure / tagging
└── _work/                          ← 过程件（gitignore）
```

## 章节绑定表

| 章节 | 落点 | 交付物 |
|---|---|---|
| ch9 迷宫探险 | `data/levels/`+`scripts/` | 结构化地图规约+寻路断言+存档校验 |
| ch16 关卡生成 v2 | `tools/`（随章节落） | 难度规约+种子复现关卡生成器+无效关卡自检 |
