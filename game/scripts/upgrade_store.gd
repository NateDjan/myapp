extends Node
## Meta-progression: coins, upgrades, unlockable skins (cosmetic).

const SAVE_PATH := "user://neon_bubble_save.json"

var coins: int = 0
## Keys: move, jump, bubble_cd, luck — levels start at 1.
var upgrades: Dictionary = {"move": 1, "jump": 1, "bubble_cd": 1, "luck": 1}
var unlocked_skins: Array[String] = ["default", "magenta", "lime"]
var selected_skin: String = "default"


func _ready() -> void:
	load_game()


func move_bonus() -> float:
	return 1.0 + (upgrades.get("move", 1) - 1) * 0.06


func jump_bonus() -> float:
	return 1.0 + (upgrades.get("jump", 1) - 1) * 0.05


func bubble_cd_bonus() -> float:
	return 1.0 + (upgrades.get("bubble_cd", 1) - 1) * 0.07


func luck_bonus() -> float:
	return 1.0 + (upgrades.get("luck", 1) - 1) * 0.05


func add_coins(n: int) -> void:
	coins = maxi(0, coins + n)
	save_game()


func spend_coins(n: int) -> bool:
	if coins < n:
		return false
	coins -= n
	save_game()
	return true


func bump_upgrade(key: String, max_level: int = 8, cost: int = 25) -> bool:
	if upgrades.get(key, 1) >= max_level:
		return false
	if not spend_coins(cost):
		return false
	upgrades[key] = upgrades.get(key, 1) + 1
	save_game()
	return true


func save_game() -> void:
	var data := {
		"coins": coins,
		"upgrades": upgrades.duplicate(),
		"unlocked_skins": unlocked_skins.duplicate(),
		"selected_skin": selected_skin,
	}
	var json := JSON.stringify(data)
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(json)


func load_game() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if not f:
		return
	var text := f.get_as_text()
	var data = JSON.parse_string(text)
	if typeof(data) != TYPE_DICTIONARY:
		return
	coins = int(data.get("coins", 0))
	var u: Variant = data.get("upgrades", {})
	if typeof(u) == TYPE_DICTIONARY:
		for k in u.keys():
			upgrades[str(k)] = int(u[k])
	var skins = data.get("unlocked_skins", unlocked_skins)
	if skins is Array:
		unlocked_skins.clear()
		for s in skins:
			unlocked_skins.append(str(s))
	selected_skin = str(data.get("selected_skin", "default"))
