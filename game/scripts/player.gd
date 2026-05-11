extends CharacterBody2D
## Dragon joueur (hommage Bubble Bobble — graphismes originaux). Tête + queue animée.

const BUBBLE_SCENE := preload("res://scenes/bubble.tscn")

@export var base_speed: float = 300.0
@export var jump_velocity: float = -400.0
@export var shoot_cooldown: float = 0.26

## Invulnérabilité après dégât (réglée par LevelManager).
var iframes_sec: float = 0.0

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
@onready var flip: Node2D = $Flip
@onready var tail_poly: Polygon2D = $Flip/Tail
@onready var body_poly: Polygon2D = $Flip/Body
@onready var belly_poly: Polygon2D = $Flip/Belly
@onready var head_poly: Polygon2D = $Flip/Head
@onready var snout_poly: Polygon2D = $Flip/Snout
@onready var horn_poly: Polygon2D = $Flip/Horn
@onready var foot_l: Polygon2D = $Flip/FootL
@onready var foot_r: Polygon2D = $Flip/FootR


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
	collision_mask = 1 + 8
	apply_skin(UpgradeStore.selected_skin if UpgradeStore else "default")


func _process(_delta: float) -> void:
	if tail_poly:
		tail_poly.rotation = sin(Time.get_ticks_msec() * 0.005) * 0.4
	if flip:
		if iframes_sec > 0.0:
			flip.modulate = Color(1.0, 1.0, 1.0, 0.45 + 0.45 * sin(Time.get_ticks_msec() * 0.025))
		else:
			flip.modulate = Color(1, 1, 1, 1)


func _physics_process(delta: float) -> void:
	iframes_sec = maxf(0.0, iframes_sec - delta)
	_shoot_cd = maxf(0.0, _shoot_cd - delta)
	_slow_timer = maxf(0.0, _slow_timer - delta)
	_freeze_emit_timer = maxf(0.0, _freeze_emit_timer - delta)

	var sp := base_speed * UpgradeStore.move_bonus() if UpgradeStore else base_speed
	var grav_scale := 1.0 if _slow_timer <= 0.0 else 0.78
	var dir := _read_move_axis()
	if dir != 0.0:
		facing = signf(dir)
	if muzzle:
		muzzle.position.x = 34.0 * facing
	if flip:
		flip.scale.x = facing
	velocity.x = move_toward(velocity.x, dir * sp, sp * 14.0 * delta)

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
	if absf(x) < 0.18:
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
	var spread := deg_to_rad(10.0)
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
	var spd := 340.0 * (0.92 if _slow_timer > 0.0 else 1.0)
	if bubble.has_method("configure"):
		bubble.call("configure", d, spd, _next_giant, _next_electric)
	_next_giant = false
	_next_electric = false


func apply_powerup(kind: int) -> void:
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
	if body_poly == null:
		return
	match skin:
		"magenta":
			_set_dragon_colors(
				Color(0.88, 0.28, 0.62, 1.0),
				Color(1.0, 0.72, 0.88, 1.0),
				Color(0.75, 0.22, 0.48, 1.0)
			)
		"lime":
			_set_dragon_colors(
				Color(0.32, 0.85, 0.38, 1.0),
				Color(0.92, 1.0, 0.55, 1.0),
				Color(0.22, 0.65, 0.32, 1.0)
			)
		_:
			_set_dragon_colors(
				Color(0.18, 0.78, 0.48, 1.0),
				Color(0.98, 0.96, 0.45, 1.0),
				Color(0.12, 0.62, 0.38, 1.0)
			)


func _set_dragon_colors(body: Color, belly: Color, tail_dark: Color) -> void:
	body_poly.color = body
	belly_poly.color = belly
	head_poly.color = body.lightened(0.06)
	snout_poly.color = body.lightened(0.1)
	horn_poly.color = Color(0.95, 0.52, 0.28, 1.0)
	tail_poly.color = tail_dark
	foot_l.color = tail_dark.darkened(0.05)
	foot_r.color = tail_dark.darkened(0.05)


func is_damage_invulnerable() -> bool:
	return iframes_sec > 0.0


func is_slow_active() -> bool:
	return _slow_timer > 0.0


func global_time_scale_mod() -> float:
	return 0.58 if _slow_timer > 0.0 else 1.0
