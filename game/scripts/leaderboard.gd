extends Node
## Local scores plus optional REST sync. Set `leaderboard/api_base_url` in Project Settings.

signal remote_updated()

const PATH := "user://leaderboard_local.json"
const MAX_ENTRIES := 20

var entries: Array = []
var remote_lines: String = ""
var _submit_http: HTTPRequest
var _fetch_http: HTTPRequest
var _last_http_error: String = ""


func _ready() -> void:
	load_scores()
	_submit_http = HTTPRequest.new()
	_submit_http.request_completed.connect(_on_submit_done)
	add_child(_submit_http)
	_fetch_http = HTTPRequest.new()
	_fetch_http.request_completed.connect(_on_fetch_done)
	add_child(_fetch_http)


func api_base_url() -> String:
	if ProjectSettings.has_setting("leaderboard/api_base_url"):
		return str(ProjectSettings.get_setting("leaderboard/api_base_url", "")).strip_edges()
	return ""


func api_key() -> String:
	if ProjectSettings.has_setting("leaderboard/api_key"):
		return str(ProjectSettings.get_setting("leaderboard/api_key", "")).strip_edges()
	return ""


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


func submit_remote(name: String, score: int, mode: String = "arcade") -> void:
	var base := api_base_url()
	if base.is_empty() or _submit_http == null:
		return
	var url := base.rstrip("/") + "/scores"
	var payload := JSON.stringify({"name": name.substr(0, 16), "score": score, "mode": mode})
	var headers := PackedStringArray(["Content-Type: application/json"])
	var key := api_key()
	if not key.is_empty():
		headers.append("X-API-Key: " + key)
	var err := _submit_http.request(url, headers, HTTPClient.METHOD_POST, payload)
	if err != OK:
		_last_http_error = "submit request err %d" % err


func fetch_remote_preview() -> void:
	var base := api_base_url()
	if base.is_empty() or _fetch_http == null:
		remote_lines = ""
		return
	var url := base.rstrip("/") + "/scores?limit=10"
	var headers := PackedStringArray()
	var key := api_key()
	if not key.is_empty():
		headers.append("X-API-Key: " + key)
	var err := _fetch_http.request(url, headers, HTTPClient.METHOD_GET)
	if err != OK:
		_last_http_error = "fetch request err %d" % err


func top_display() -> String:
	var lines: PackedStringArray = []
	lines.append("— LOCAL —")
	var i := 1
	for e in entries.slice(0, 10):
		lines.append("%d. %s — %d" % [i, e.get("name", "?"), e.get("score", 0)])
		i += 1
	if not remote_lines.is_empty():
		lines.append("")
		lines.append(remote_lines)
	if not _last_http_error.is_empty():
		lines.append("")
		lines.append("API: " + _last_http_error)
	return "\n".join(lines)


func _sort_entries() -> void:
	entries.sort_custom(func(a, b): return int(a.get("score", 0)) > int(b.get("score", 0)))


func _persist() -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(entries))


func _on_submit_done(_result: int, response_code: int, _headers: PackedStringArray, _body: PackedByteArray) -> void:
	if response_code >= 400:
		_last_http_error = "submit HTTP %d" % response_code
	else:
		_last_http_error = ""


func _on_fetch_done(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	if response_code != 200:
		_last_http_error = "fetch HTTP %d" % response_code
		remote_lines = ""
		return
	_last_http_error = ""
	var text := body.get_string_from_utf8()
	var data = JSON.parse_string(text)
	if data == null:
		remote_lines = "— ONLINE —\n(invalid JSON)"
		return
	if typeof(data) == TYPE_DICTIONARY and data.has("scores"):
		data = data["scores"]
	if typeof(data) != TYPE_ARRAY:
		remote_lines = "— ONLINE —\n(unexpected shape)"
		return
	var out: PackedStringArray = ["— ONLINE —"]
	var rank := 1
	for e in data:
		if rank > 10:
			break
		if typeof(e) == TYPE_DICTIONARY:
			out.append(
				"%d. %s — %d"
				% [rank, str(e.get("name", "?")), int(e.get("score", 0))]
			)
		elif typeof(e) == TYPE_ARRAY and e.size() >= 2:
			out.append("%d. %s — %s" % [rank, str(e[0]), str(e[1])])
		rank += 1
	remote_lines = "\n".join(out)
	remote_updated.emit()
