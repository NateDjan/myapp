extends Node
## Local top scores; swap `submit_remote` body for your HTTP API later.

const PATH := "user://leaderboard_local.json"
const MAX_ENTRIES := 20

var entries: Array[Dictionary] = []


func _ready() -> void:
	load_scores()


func load_scores() -> void:
	entries.clear()
	if not FileAccess.file_exists(PATH):
		return
	var f := FileAccess.open(PATH, FileAccess.READ)
	if not f:
		return
	var data = JSON.parse_string(f.get_as_text())
	if typeof(data) != TYPE_ARRAY:
		return
	for e in data:
		if typeof(e) == TYPE_DICTIONARY:
			entries.append(
				{"name": str(e.get("name", "Pilot")), "score": int(e.get("score", 0)), "mode": str(e.get("mode", "arcade"))}
			)
	_sort_entries()


func submit_local(name: String, score: int, mode: String = "arcade") -> void:
	entries.append({"name": name.substr(0, 12), "score": score, "mode": mode})
	_sort_entries()
	if entries.size() > MAX_ENTRIES:
		entries.resize(MAX_ENTRIES)
	_persist()


func top_display() -> String:
	var lines: PackedStringArray = []
	var i := 1
	for e in entries.slice(0, 10):
		lines.append("%d. %s — %d" % [i, e.get("name", "?"), e.get("score", 0)])
		i += 1
	return "\n".join(lines)


func _sort_entries() -> void:
	entries.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.get("score", 0) > b.get("score", 0))


func _persist() -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(entries))


## Placeholder for future REST leaderboard.
func submit_remote(_name: String, _score: int, _mode: String) -> void:
	pass
