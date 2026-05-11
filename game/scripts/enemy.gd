extends CharacterBody2D
## Bubble Bobble–style blob monster: patrols platforms; bubbled → floats; stomp to score.

signal popped(enemy: Node, points: int)
signal trapped_state_changed(enemy: Node, bubbled: bool)

enum State { ROAM, CHASE, BUBBLED }

const POP_DISTANCE := 76.0

@export var move_speed: float = 56.0
@export var max_hp: int = 1
@export var is_boss: bool = false

var state: State = State.ROAM
var hp: int = 1
var patrol_dir: float = 1.0
var _freeze_timer: float = 0.0
var _stomp_cd: float = 0.0
var _player: CharacterBody2D

@onready var visual: Polygon2D = $Body


func _ready() -> void:
	add_to_group("enemies")
	hp = max_hp
	patrol_dir = 1.0 if randf() > 0.5 else -1.0
	if visual:
		_tint_from_seed()


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
	position = Vector2(0, -14)
	z_index = -1


func _physics_process(delta: float) -> void:
	if _freeze_timer > 0.0:
		_freeze_timer -= delta
		return

	match state:
		State.BUBBLED:
			_stomp_cd = maxf(0.0, _stomp_cd - delta)
			_try_pop_by_player()
		State.CHASE, State.ROAM:
			_move_patrol(delta)


func _try_pop_by_player() -> void:
	if _player == null or _stomp_cd > 0.0:
		return
	# Zone large : buste / corne (comme sauter dans la bulle).
	var aim := _player.global_position + Vector2(0.0, -16.0)
	if aim.distance_to(global_position) < POP_DISTANCE:
		_stomp_cd = 0.22
		_apply_bubble_stomp()


func _apply_bubble_stomp() -> void:
	hp -= 1
	if hp <= 0:
		_finalize_pop()
	elif ArcadeSfx:
		ArcadeSfx.play_pop(1.15)


func _finalize_pop() -> void:
	var bonus := maxi(0, (max_hp - 1) * 5)
	var pts := ComboManager.register_pop(20 + bonus) if ComboManager else 20
	popped.emit(self, pts)
	queue_free()


func stomp_pop() -> void:
	if state == State.BUBBLED:
		_apply_bubble_stomp()


func damage(amount: int = 1) -> void:
	hp -= amount
	if hp <= 0 and state != State.BUBBLED:
		var pts := ComboManager.register_pop(12) if ComboManager else 12
		popped.emit(self, pts)
		queue_free()


func _move_patrol(delta: float) -> void:
	var sp := move_speed
	velocity.x = patrol_dir * sp

	if not is_on_floor():
		velocity.y += 980.0 * delta
	else:
		velocity.y = 0.0

	move_and_slide()

	if is_on_wall():
		patrol_dir *= -1.0

	if is_on_floor():
		var ahead := global_position + Vector2(patrol_dir * 22.0, 14.0)
		var drop_ahead := ahead + Vector2(0.0, 56.0)
		var space := get_world_2d().direct_space_state
		var q := PhysicsRayQueryParameters2D.create(ahead, drop_ahead)
		q.collision_mask = 1
		q.exclude = [self]
		var hit := space.intersect_ray(q)
		if hit.is_empty():
			patrol_dir *= -1.0

	if is_on_floor() and randf() < 0.004 * delta * 60.0:
		velocity.y = -260.0 - move_speed * 0.12


func _tint_from_seed() -> void:
	if visual == null:
		return
	var hue := fposmod(float(hash(str(global_position))), 1.0)
	var body_col := Color.from_hsv(hue, 0.85, 1.0, 1.0)
	visual.color = body_col
	if is_boss:
		visual.color = Color(1.0, 0.25, 0.45, 1.0)
		scale = Vector2(2.4, 2.4)
