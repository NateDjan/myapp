extends Node
## Boot flow: menu, HUD, rank / upgrades, leaderboard, and world wiring.

const TOUCH_HUD_SCENE := preload("res://scenes/touch_hud.tscn")

@onready var title_layer: CanvasLayer = $CanvasTitle
@onready var hud_layer: CanvasLayer = $CanvasHUD
@onready var rank_layer: CanvasLayer = $CanvasRank
@onready var game_over_layer: CanvasLayer = $CanvasGameOver
@onready var leaderboard_layer: CanvasLayer = $CanvasLeaderboard
@onready var game_world: Node2D = $GameWorld
@onready var world: Node2D = $GameWorld/World
@onready var level_manager: Node = $GameWorld/World/LevelManager
@onready var player: CharacterBody2D = $GameWorld/World/Player
var _follow_cam: Camera2D
var _touch_hud: CanvasLayer


func _ready() -> void:
	_follow_cam = world.get_node_or_null("Camera2D") as Camera2D
	game_world.visible = false
	hud_layer.hide()
	rank_layer.hide()
	game_over_layer.hide()
	leaderboard_layer.hide()
	if ComboManager:
		ComboManager.score_changed.connect(_on_score)
		ComboManager.combo_changed.connect(_on_combo)
	if level_manager:
		level_manager.level_cleared.connect(_on_level_cleared)
		level_manager.game_over.connect(_on_game_over)
		level_manager.kills_updated.connect(_on_kills)
		if level_manager.has_signal("lives_changed"):
			level_manager.lives_changed.connect(_on_lives)
	_connect_title_buttons()
	_connect_rank_buttons()
	_connect_go_buttons()
	_connect_lb_buttons()
	_touch_hud = TOUCH_HUD_SCENE.instantiate()
	add_child(_touch_hud)
	if Leaderboard:
		Leaderboard.remote_updated.connect(_on_leaderboard_remote)
	_refresh_hud()


func _process(_delta: float) -> void:
	if game_world.visible and _follow_cam and is_instance_valid(player):
		_follow_cam.global_position = _follow_cam.global_position.lerp(
			player.global_position + Vector2(0, -100),
			0.12
		)


func _connect_title_buttons() -> void:
	title_layer.get_node("CenterContainer/VBoxContainer/Arcade").pressed.connect(_start_arcade)
	title_layer.get_node("CenterContainer/VBoxContainer/Daily").pressed.connect(_start_daily)
	title_layer.get_node("CenterContainer/VBoxContainer/Leaderboard").pressed.connect(_open_leaderboard)
	title_layer.get_node("CenterContainer/VBoxContainer/Skins").pressed.connect(_cycle_skin)


func _connect_rank_buttons() -> void:
	rank_layer.get_node("Panel/VBox/HBox/Next").pressed.connect(_on_rank_next)
	rank_layer.get_node("Panel/VBox/HBox/Shop").pressed.connect(_on_rank_shop)
	rank_layer.get_node("Panel/VBox/HBox/Menu").pressed.connect(_back_menu)


func _connect_go_buttons() -> void:
	game_over_layer.get_node("Panel/VBox/HBox/Retry").pressed.connect(_start_arcade)
	game_over_layer.get_node("Panel/VBox/HBox/Menu").pressed.connect(_back_menu)


func _connect_lb_buttons() -> void:
	leaderboard_layer.get_node("Panel/VBox/Close").pressed.connect(_close_leaderboard)


func _start_arcade() -> void:
	level_manager.configure_arcade()
	_begin_game()


func _start_daily() -> void:
	level_manager.configure_daily()
	_begin_game()


func _begin_game() -> void:
	title_layer.hide()
	game_world.visible = true
	if _touch_hud and _touch_hud.has_method("set_gameplay_active"):
		_touch_hud.set_gameplay_active(true)
	if is_instance_valid(player):
		player.global_position = Vector2(360, 965)
		player.velocity = Vector2.ZERO
	hud_layer.show()
	rank_layer.hide()
	game_over_layer.hide()
	level_manager.start_run()


func _back_menu() -> void:
	Engine.time_scale = 1.0
	game_world.visible = false
	if _touch_hud and _touch_hud.has_method("set_gameplay_active"):
		_touch_hud.set_gameplay_active(false)
	hud_layer.hide()
	rank_layer.hide()
	game_over_layer.hide()
	title_layer.show()


func _open_leaderboard() -> void:
	_refresh_leaderboard_body()
	if Leaderboard:
		Leaderboard.fetch_remote_preview()
	leaderboard_layer.show()


func _close_leaderboard() -> void:
	leaderboard_layer.hide()


func _refresh_leaderboard_body() -> void:
	var body: Label = leaderboard_layer.get_node("Panel/VBox/Body")
	body.text = Leaderboard.top_display() if Leaderboard else ""


func _on_leaderboard_remote() -> void:
	if leaderboard_layer.visible:
		_refresh_leaderboard_body()


func _cycle_skin() -> void:
	if UpgradeStore == null:
		return
	var skins := UpgradeStore.unlocked_skins
	var i := skins.find(UpgradeStore.selected_skin)
	i = (i + 1) % skins.size()
	UpgradeStore.selected_skin = skins[i]
	UpgradeStore.save_game()
	if player.has_method("apply_skin"):
		player.apply_skin(UpgradeStore.selected_skin)


func _on_score(total: int) -> void:
	var big: Label = hud_layer.get_node_or_null("ScoreBig") as Label
	if big:
		big.text = "%06d" % total
	hud_layer.get_node("MarginContainer/VBox/Score").text = "SCORE %d" % total


func _on_combo(mult: int, streak: int) -> void:
	hud_layer.get_node("MarginContainer/VBox/Combo").text = "CHAIN x%d  (%d pops)" % [mult, streak]


func _on_kills(done: int, target: int) -> void:
	hud_layer.get_node("MarginContainer/VBox/Wave").text = "MONSTRES %d / %d" % [done, target]


func _on_lives(n: int) -> void:
	var lab: Label = hud_layer.get_node_or_null("MarginContainer/VBox/Lives") as Label
	if lab:
		var hearts := ""
		for _i in range(clampi(n, 0, 9)):
			hearts += "♥"
		lab.text = "VIES  %s  (%d)" % [hearts, n]


func _refresh_hud() -> void:
	if ComboManager:
		_on_score(ComboManager.score)
		_on_combo(ComboManager.multiplier, ComboManager.streak)


func _on_level_cleared(level: int, rank: String, score: int) -> void:
	if _touch_hud and _touch_hud.has_method("set_gameplay_active"):
		_touch_hud.set_gameplay_active(false)
	rank_layer.get_node("Panel/VBox/Rank").text = rank
	rank_layer.get_node("Panel/VBox/Detail").text = "LEVEL %d CLEARED\nSCORE %d" % [level, score]
	rank_layer.get_node("Panel/VBox/Coins").text = "COINS %d" % (UpgradeStore.coins if UpgradeStore else 0)
	rank_layer.show()


func _on_rank_next() -> void:
	rank_layer.hide()
	level_manager.continue_next_level()
	if _touch_hud and _touch_hud.has_method("set_gameplay_active") and game_world.visible:
		_touch_hud.set_gameplay_active(true)


func _on_rank_shop() -> void:
	if UpgradeStore == null:
		return
	var cost := 30
	var line: Label = rank_layer.get_node("Panel/VBox/Detail")
	if UpgradeStore.bump_upgrade("move", 8, cost):
		line.text = "Upgraded MOVE (Lv%d)" % UpgradeStore.upgrades.get("move", 1)
	elif UpgradeStore.bump_upgrade("bubble_cd", 8, cost):
		line.text = "Upgraded BUBBLE CD (Lv%d)" % UpgradeStore.upgrades.get("bubble_cd", 1)
	elif UpgradeStore.bump_upgrade("luck", 8, cost):
		line.text = "Upgraded LUCK (Lv%d)" % UpgradeStore.upgrades.get("luck", 1)
	else:
		line.text = "Need %d coins for next tier." % cost
	rank_layer.get_node("Panel/VBox/Coins").text = "COINS %d" % UpgradeStore.coins


func _on_game_over(final_score: int) -> void:
	if _touch_hud and _touch_hud.has_method("set_gameplay_active"):
		_touch_hud.set_gameplay_active(false)
	game_over_layer.get_node("Panel/VBox/Score").text = "SCORE %d" % final_score
	game_over_layer.show()


func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode == KEY_F3:
		if _touch_hud and _touch_hud.has_method("toggle_debug_touch"):
			_touch_hud.toggle_debug_touch()
			if _touch_hud.has_method("set_gameplay_active"):
				_touch_hud.set_gameplay_active(game_world.visible)
	elif event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		if rank_layer.visible:
			_on_rank_next()
		elif game_over_layer.visible:
			_back_menu()
		elif leaderboard_layer.visible:
			_close_leaderboard()
		elif game_world.visible:
			_back_menu()
