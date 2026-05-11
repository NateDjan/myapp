extends CharacterBody2D
## Simple chase AI; can be bubbled, floated, and popped for score.

const _NeonArt := preload("res://scripts/neon_runtime_art.gd")

signal popped(enemy: Node, points: int)
signal trapped_state_changed(enemy: Node, bubbled: bool)

enum State { ROAM, CHASE, BUBBLED }

const POP_DISTANCE := 30.0

@export var move_speed: float = 110.0
@export var max_hp: int = 1
@export var is_boss: bool = false

var state: State = State.ROAM
var hp: int = 1
var _wander_dir: float = 1.0
var _freeze_timer: float = 0.0
var _player: CharacterBody2D

@onready var visual: Polygon2D = $Polygon2D


func _ready() -> void:
	add_to_group("enemies")
	hp = max_hp
	if visual:
		_tint_from_seed()
		_NeonArt.attach_blob_sprite(visual, "enemy_%d" % get_instance_id())


func bind_player(p: CharacterBody2D) -> void:
	_player = p


func set_difficulty_scale(s: float) -> void:
	move_speed *= s


func apply_freeze(duration: float) -> void:
	_freeze_timer = maxf(_freeze_timer, duration)
	if visual:
		visual.modulate = visual.modulate.lerp(Color(0.7, 0.9, 1.2), 0.5)


func enter_bubble(bubble: Node2D) -> void:
	if state == State.BUBBLED:
		return
	state = State.BUBBLED
	collision_layer = 0
	collision_mask = 0
	trapped_state_changed.emit(self, true)
	reparent(bubble)
	position = Vector2(0, -10)
	z_index = -1


func _physics_process(delta: float) -> void:
	if _freeze_timer > 0.0:
		_freeze_timer -= delta
		return

	match state:
		State.BUBBLED:
			_try_pop_by_player()
		State.CHASE, State.ROAM:
			_move_ai(delta)


func _try_pop_by_player() -> void:
	if _player == null:
		return
	if global_position.distance_to(_player.global_position) < POP_DISTANCE:
		_pop()


func _pop() -> void:
	var pts := ComboManager.register_pop(15 + (hp - 1) * 5) if ComboManager else 10
	popped.emit(self, pts)
	queue_free()


func stomp_pop() -> void:
	if state == State.BUBBLED:
		_pop()


func damage(amount: int = 1) -> void:
	hp -= amount
	if hp <= 0 and state != State.BUBBLED:
		# raw kill without bubble — small reward
		if ComboManager:
			ComboManager.register_pop(6)
		popped.emit(self, 6)
		queue_free()


func _move_ai(delta: float) -> void:
	if _player == null:
		velocity.x = _wander_dir * move_speed * 0.4
	else:
		var to_player := _player.global_position.x - global_position.x
		if absf(to_player) > 12.0:
			velocity.x = signf(to_player) * move_speed
			state = State.CHASE
		else:
			velocity.x = move_toward(velocity.x, 0.0, move_speed * 2.0 * delta)

	if not is_on_floor():
		velocity.y += 980.0 * delta
	else:
		velocity.y = 0.0
		if randf() < 0.012 * delta * 60.0:
			velocity.y = -320.0 - move_speed * 0.15

	move_and_slide()


func _tint_from_seed() -> void:
	if visual == null:
		return
	var hue := fposmod(float(hash(global_position)), 1.0)
	visual.color = Color.from_hsv(hue, 0.72, 1.0, 1.0)
	if is_boss:
		visual.color = Color(1.0, 0.35, 0.55, 1.0)
		scale = Vector2(2.2, 2.2)
