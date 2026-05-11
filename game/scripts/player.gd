extends CharacterBody2D
## Minimal controls: move, jump, shoot; powerups tweak cadence and bubble style.

const BUBBLE_SCENE := preload("res://scenes/bubble.tscn")
const _NeonArt := preload("res://scripts/neon_runtime_art.gd")

@export var base_speed: float = 260.0
@export var jump_velocity: float = -420.0
@export var shoot_cooldown: float = 0.38

var facing: float = 1.0
var _shoot_cd: float = 0.0
var _multi_shots: int = 1
var _next_giant: bool = false
var _next_electric: bool = false
var _slow_timer: float = 0.0
var _freeze_emit_timer: float = 0.0
var _jump_pressed: bool = false
var _shoot_pressed: bool = false

@onready var muzzle: Marker2D = $Muzzle
@onready var visual: Polygon2D = $Polygon2D


func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_SPACE, KEY_UP, KEY_W:
				_jump_pressed = true
			KEY_Z, KEY_X:
				_shoot_pressed = true


func _ready() -> void:
	add_to_group("player")
	collision_layer = 2
	collision_mask = 1 + 8 # world + bubble platforms
	apply_skin(UpgradeStore.selected_skin if UpgradeStore else "default")
	if visual:
		_NeonArt.attach_blob_sprite(visual, "player")


func _physics_process(delta: float) -> void:
	_shoot_cd = maxf(0.0, _shoot_cd - delta)
	_slow_timer = maxf(0.0, _slow_timer - delta)
	_freeze_emit_timer = maxf(0.0, _freeze_emit_timer - delta)

	var sp := base_speed * UpgradeStore.move_bonus() if UpgradeStore else base_speed
	var grav_scale := 1.0 if _slow_timer <= 0.0 else 0.78
	var dir := _read_move_axis()
	if dir != 0.0:
		facing = signf(dir)
	if muzzle:
		muzzle.position.x = 22.0 * facing
	if visual:
		visual.scale.x = facing
	velocity.x = move_toward(velocity.x, dir * sp, sp * 10.0 * delta)

	var on_floor_before := is_on_floor()
	if not on_floor_before:
		velocity.y += 980.0 * grav_scale * delta
	else:
		if _consume_jump():
			var jv := jump_velocity * UpgradeStore.jump_bonus() if UpgradeStore else jump_velocity
			velocity.y = jv

	move_and_slide()
	if not on_floor_before and is_on_floor() and ArcadeSfx:
		ArcadeSfx.play_land()

	if _consume_shoot() and _shoot_cd <= 0.0:
		_shoot_bubbles()
		var cd := shoot_cooldown / (UpgradeStore.bubble_cd_bonus() if UpgradeStore else 1.0)
		_shoot_cd = cd


func _read_move_axis() -> float:
	var x := Input.get_axis("ui_left", "ui_right")
	if absf(x) < 0.2:
		x = 0.0
	if TouchInput and absf(TouchInput.move_axis) > 0.08:
		x = TouchInput.move_axis
	return x


func _consume_jump() -> bool:
	if Input.is_action_just_pressed("ui_accept"):
		return true
	if TouchInput and TouchInput.consume_jump():
		return true
	if _jump_pressed:
		_jump_pressed = false
		return true
	return false


func _consume_shoot() -> bool:
	if Input.is_action_just_pressed("ui_select"):
		return true
	if TouchInput and TouchInput.consume_shoot():
		return true
	if _shoot_pressed:
		_shoot_pressed = false
		return true
	return false


func _shoot_bubbles() -> void:
	var count := maxi(1, _multi_shots)
	var spread := deg_to_rad(12.0)
	var base_dir := Vector2(facing, 0)
	for i in count:
		var ang := spread * (float(i) - float(count - 1) * 0.5)
		var d := base_dir.rotated(ang)
		_spawn_bubble(d)
	_multi_shots = 1
	if ArcadeSfx:
		ArcadeSfx.play_shoot()


func _spawn_bubble(d: Vector2) -> void:
	var bubble: Node = BUBBLE_SCENE.instantiate()
	var root := get_tree().current_scene
	var holder: Node = null
	if root:
		holder = root.get_node_or_null("GameWorld/World/Bubbles")
	if holder:
		holder.add_child(bubble)
	else:
		get_parent().add_child(bubble)
	bubble.global_position = muzzle.global_position
	var spd := 380.0 * (0.92 if _slow_timer > 0.0 else 1.0)
	if bubble.has_method("configure"):
		bubble.call("configure", d, spd, _next_giant, _next_electric)
	_next_giant = false
	_next_electric = false


func apply_powerup(kind: int) -> void:
	# Matches powerup.gd Kind enum order.
	match kind:
		0:
			_multi_shots = 3
		1:
			_next_giant = true
		2:
			_freeze_emit_timer = 2.4
			_emit_freeze_wave()
		3:
			_next_electric = true
		4:
			_slow_timer = 2.6


func _emit_freeze_wave() -> void:
	var lm := get_tree().current_scene.get_node_or_null("GameWorld/World/LevelManager") if get_tree().current_scene else null
	if lm and lm.has_method("apply_freeze_all"):
		lm.apply_freeze_all(2.2)


func apply_skin(skin: String) -> void:
	if visual == null:
		return
	match skin:
		"magenta":
			visual.color = Color(1.0, 0.35, 0.85, 1.0)
		"lime":
			visual.color = Color(0.55, 1.0, 0.35, 1.0)
		_:
			visual.color = Color(0.25, 0.95, 0.95, 1.0)
	var spr := get_node_or_null("NeonSprite") as Sprite2D
	if spr:
		spr.modulate = visual.color


func is_slow_active() -> bool:
	return _slow_timer > 0.0


func global_time_scale_mod() -> float:
	return 0.58 if _slow_timer > 0.0 else 1.0
