extends Node
## Procedural waves, difficulty ramp, boss cadence, pickups, and fail state.

signal level_cleared(level: int, rank: String, score: int)
signal game_over(final_score: int)
signal kills_updated(done: int, target: int)

const ENEMY_SCENE := preload("res://scenes/enemy.tscn")
const POWERUP_SCENE := preload("res://scenes/powerup.tscn")
const VfxBurst := preload("res://scripts/vfx_burst.gd")
const FloatingPopup := preload("res://scripts/floating_popup.gd")
const ENEMY_STATE_BUBBLED := 2

var run_mode: int = 0 # 0 arcade, 1 daily
var level_index: int = 1
var kills_target: int = 8
var kills_done: int = 0
var rng := RandomNumberGenerator.new()
var difficulty: float = 1.0
var active: bool = false
var level_elapsed: float = 0.0
var _hurt_cd: float = 0.0

@onready var enemies_holder: Node2D = $"../Enemies"
@onready var bubbles_holder: Node2D = $"../Bubbles"
@onready var pickups_holder: Node2D = $"../Pickups"
@onready var vfx_holder: Node2D = $"../VFX"
@onready var player: CharacterBody2D = $"../Player"


func configure_arcade() -> void:
	run_mode = 0
	rng.seed = randi()


func configure_daily() -> void:
	run_mode = 1
	var d := Time.get_datetime_dict_from_system()
	rng.seed = int(d.year) * 10000 + int(d.month) * 100 + int(d.day)


func start_run() -> void:
	_clear_world_entities()
	active = true
	level_index = 1
	difficulty = 1.0
	kills_done = 0
	level_elapsed = 0.0
	if ComboManager:
		ComboManager.reset_run()
	_plan_wave()
	_spawn_wave()


func _physics_process(delta: float) -> void:
	if not active:
		return
	level_elapsed += delta
	_hurt_cd = maxf(0.0, _hurt_cd - delta)
	_update_slow_motion()
	_check_player_hit()


func _update_slow_motion() -> void:
	var slow := false
	for p in get_tree().get_nodes_in_group("player"):
		if p.has_method("is_slow_active") and p.is_slow_active():
			slow = true
			break
	Engine.time_scale = 0.58 if slow else 1.0


func _plan_wave() -> void:
	var boss_wave := level_index % 10 == 0
	if boss_wave:
		kills_target = 1
	else:
		kills_target = mini(36, 6 + level_index * 2)
	kills_updated.emit(kills_done, kills_target)


func _spawn_wave() -> void:
	var boss_wave := level_index % 10 == 0
	if boss_wave:
		_spawn_boss()
		return
	var count := mini(10, 2 + level_index / 2)
	for i in count:
		_spawn_enemy(false)


func _spawn_boss() -> void:
	var e := ENEMY_SCENE.instantiate()
	e.is_boss = true
	e.max_hp = 1
	e.hp = 1
	enemies_holder.add_child(e)
	_bind_enemy(e)
	e.global_position = Vector2(360, 140)


func _spawn_enemy(is_extra: bool) -> void:
	var e := ENEMY_SCENE.instantiate()
	enemies_holder.add_child(e)
	_bind_enemy(e)
	var x := rng.randf_range(120.0, 600.0)
	var y := rng.randf_range(90.0, 220.0)
	e.global_position = Vector2(x, y)
	if not is_extra and e.has_method("set_difficulty_scale"):
		e.call("set_difficulty_scale", difficulty)


func _bind_enemy(e: Node) -> void:
	if e.has_method("bind_player"):
		e.call("bind_player", player)
	if e.has_signal("popped"):
		e.popped.connect(_on_enemy_popped)


func _on_enemy_popped(enemy: Node, _points: int) -> void:
	if not active:
		return
	kills_done += 1
	kills_updated.emit(kills_done, kills_target)
	_juice_at(enemy.global_position)
	_maybe_drop_pickup(enemy.global_position)
	if kills_done >= kills_target:
		_finish_level()


func _finish_level() -> void:
	active = false
	Engine.time_scale = 1.0
	_clear_world_entities()
	var rank := _compute_rank()
	var sc := ComboManager.score if ComboManager else 0
	var coin_gain := kills_target * 3 + level_index * 4
	if UpgradeStore:
		UpgradeStore.add_coins(coin_gain)
	level_cleared.emit(level_index, rank, sc)
	level_index += 1
	difficulty = mini(2.4, difficulty + 0.07)


func continue_next_level() -> void:
	kills_done = 0
	if ComboManager:
		ComboManager.reset_combo()
	active = true
	level_elapsed = 0.0
	_plan_wave()
	_spawn_wave()


func _compute_rank() -> String:
	var sc := ComboManager.score if ComboManager else 0
	var t := level_elapsed
	var s_threshold := 900 + level_index * 120
	if sc >= s_threshold and t < 55.0:
		return "S"
	if sc >= s_threshold * 0.72:
		return "A"
	if sc >= s_threshold * 0.48:
		return "B"
	return "C"


func _maybe_drop_pickup(at: Vector2) -> void:
	var luck := UpgradeStore.luck_bonus() if UpgradeStore else 1.0
	if rng.randf() > 0.12 * luck:
		return
	var p := POWERUP_SCENE.instantiate()
	pickups_holder.add_child(p)
	p.global_position = at + Vector2(0, -24)
	if p.has_method("setup_random"):
		p.call("setup_random", rng)


func _juice_at(p: Vector2) -> void:
	VfxBurst.spawn(vfx_holder, p, Color(0.4, 1.0, 0.85, 1.0))
	var cam: Node = get_viewport().get_camera_2d()
	if cam and cam.has_method("add_shake"):
		cam.call("add_shake", 0.18)
	if ArcadeSfx:
		ArcadeSfx.play_pop(1.0 + rng.randf() * 0.15)
	var mult := ComboManager.multiplier if ComboManager else 1
	FloatingPopup.spawn(
		vfx_holder,
		p,
		"x%d" % mult,
		Color(1.0, 0.85, 0.35) if mult > 1 else Color(0.85, 1.0, 1.0)
	)


func _check_player_hit() -> void:
	if _hurt_cd > 0.0:
		return
	for e in enemies_holder.get_children():
		if not e.is_in_group("enemies"):
			continue
		if int(e.get("state")) == ENEMY_STATE_BUBBLED:
			continue
		if player.global_position.distance_to(e.global_position) < 26.0:
			_trigger_game_over()
			return


func _trigger_game_over() -> void:
	active = false
	Engine.time_scale = 1.0
	_clear_world_entities()
	var sc := ComboManager.score if ComboManager else 0
	if ArcadeSfx:
		ArcadeSfx.play_hurt()
	if Leaderboard:
		Leaderboard.submit_local("YOU", sc, "daily" if run_mode == 1 else "arcade")
	game_over.emit(sc)


func apply_freeze_all(duration: float) -> void:
	for e in enemies_holder.get_children():
		if e.has_method("apply_freeze"):
			e.call("apply_freeze", duration)


func _clear_world_entities() -> void:
	for c in enemies_holder.get_children():
		c.queue_free()
	for c in bubbles_holder.get_children():
		c.queue_free()
	for c in pickups_holder.get_children():
		c.queue_free()
	for c in vfx_holder.get_children():
		c.queue_free()


func _on_bubble_trapped(bubble: Node, enemy: Node) -> void:
	if bubble.get("electric"):
		for e in enemies_holder.get_children():
			if e == enemy or not e.is_in_group("enemies"):
				continue
			if int(e.get("state")) != ENEMY_STATE_BUBBLED:
				continue
			if e.global_position.distance_to(enemy.global_position) < 120.0 and e.has_method("stomp_pop"):
				e.call("stomp_pop")
