extends Node2D
## 主场景脚本（骨架）：加载关卡 JSON 契约并做形状校验。
## ch9 落寻路断言与完整地图规约；本骨架只证「契约文件可加载、可校验」。

const LEVEL_PATH := "res://data/levels/level_001.json"


func _ready() -> void:
	var level := load_level(LEVEL_PATH)
	if level.is_empty():
		push_error("关卡加载失败，见上方错误。")
		return
	var grid: Array = level["grid"]
	print("关卡加载成功：%s（%d 行 × %d 列）" % [level["name"], grid.size(), (grid[0] as Array).size()])


## 读取并解析关卡契约文件；任何一步失败返回空字典（fail-fast，错误经 push_error 上报）。
func load_level(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("关卡文件打不开：%s" % path)
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("关卡契约不是 JSON 对象：%s" % path)
		return {}
	var level: Dictionary = parsed
	if not is_valid_level(level):
		push_error("关卡契约形状不合法：%s" % path)
		return {}
	return level


## 地图规约（骨架版）：必须有 name 与 grid；grid 为非空矩形数组（1=墙，0=通路）。
func is_valid_level(level: Dictionary) -> bool:
	if not level.has_all(["name", "grid"]):
		return false
	var grid: Variant = level["grid"]
	if typeof(grid) != TYPE_ARRAY or (grid as Array).is_empty():
		return false
	var width: int = (grid[0] as Array).size()
	for row in grid as Array:
		if typeof(row) != TYPE_ARRAY or (row as Array).size() != width:
			return false
	return true
