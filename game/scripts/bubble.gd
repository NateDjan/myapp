extends CharacterBody2D
## Bubble Bobble–style bubble: thick outline, trapped monster floats upward.

signal enemy_trapped(bubble: Node, enemy: Node)
signal bubble_popped(bubble: Node, world_pos: Vector2)

const FLOAT_SPEED := 52.0
const ENEMY_STATE_BUBBLED := 2

var dir: Vector2 = Vector2.RIGHT
var speed: float = 340.0
var electric: bool = false
var trapped_enemy: Node = null
var _alive: bool = true
var _platform_enabled: bool = false
var _pulse_t: float = 0.0

@onready var collider: CollisionShape2D = $CollisionShape2D
@onready var visual: Polygon2D = $Polygon2D
@onready var ring: Line2D = $Ring


func _ready() -> void:
	add_to_group("bubbles")
	collision_layer = 8
	collision_mask = 1 + 4
	if visual:
		visual.color = Color(0.45, 1.0, 0.92, 0.55)
	_build_ring()
	var lm := get_tree().current_scene.get_node_or_null("GameWorld/World/LevelManager")
	if lm and lm.has_method("_on_bubble_trapped"):
		enemy_trapped.connect(lm._on_bubble_trapped)


func _build_ring() -> void:
	if ring == null:
		return
	var pts: PackedVector2Array = []
	var segs := 20
	var rad := 22.0
	for i in segs + 1:
		var a := TAU * float(i) / float(segs)
		pts.append(Vector2(cos(a), sin(a)) * rad)
	ring.points = pts
	ring.width = 4.0
	ring.default_color = Color(0.55, 1.0, 0.95, 0.95)
	ring.closed = true


func _process(delta: float) -> void:
	if not _alive:
		return
	_pulse_t += delta
	if ring:
		var w := 3.6 + sin(_pulse_t * 7.0) * 1.3
		ring.width = w
		ring.default_color = ring.default_color.lerp(Color(0.85, 1.0, 1.0, 1.0), 0.03)


func configure(
	shot_dir: Vector2,
	shot_speed: float,
	giant: bool,
	is_electric: bool
) -> void:
	dir = shot_dir.normalized()
	speed = shot_speed
	electric = is_electric
	if giant:
		scale = Vector2(1.65, 1.65)
		speed *= 0.9
	if visual:
		visual.color = visual.color.lerp(Color(1.0, 0.55, 0.95), 0.35 if giant else 0.0)
		if electric:
			visual.color = Color(1.0, 0.95, 0.35, 0.65)
	if ring:
		if giant:
			ring.scale = Vector2(1.15, 1.15)
		ring.default_color = Color(1.0, 0.65, 0.95, 0.95) if giant else Color(0.55, 1.0, 0.95, 0.95)
		if electric:
			ring.default_color = Color(1.0, 0.95, 0.35, 1.0)


func _physics_process(_delta: float) -> void:
	if not _alive:
		return
	if trapped_enemy != null:
		velocity = Vector2(0, -FLOAT_SPEED)
		move_and_slide()
		return

	velocity = dir * speed
	move_and_slide()
	for i in get_slide_collision_count():
		var col := get_slide_collision(i)
		var collider_node := col.get_collider()
		if collider_node and collider_node.is_in_group("enemies"):
			_try_trap(collider_node)
			break
		var n := col.get_normal()
		dir = dir.bounce(n).normalized()


func _try_trap(enemy: Node) -> void:
	if int(enemy.get("state")) == ENEMY_STATE_BUBBLED:
		return
	trapped_enemy = enemy
	enemy_trapped.emit(self, enemy)
	if enemy.has_method("enter_bubble"):
		enemy.call("enter_bubble", self)
	velocity = Vector2.ZERO
	collision_mask = 1
	_enable_platform()


func _enable_platform() -> void:
	_platform_enabled = true
	collision_layer = 0
	if collider:
		collider.disabled = true
	var plate := StaticBody2D.new()
	plate.name = "RidePlate"
	plate.collision_layer = 8
	plate.collision_mask = 0
	var cs := CollisionShape2D.new()
	var sh := RectangleShape2D.new()
	sh.size = Vector2(56.0 * scale.x, 12.0)
	cs.shape = sh
	cs.one_way_collision = true
	cs.position = Vector2(0, -13.0 * scale.y)
	plate.add_child(cs)
	add_child(plate)


func pop() -> void:
	if not _alive:
		return
	_alive = false
	bubble_popped.emit(self, global_position)
	if trapped_enemy and trapped_enemy.has_method("stomp_pop"):
		trapped_enemy.call("stomp_pop")
	queue_free()


func can_ride() -> bool:
	return _platform_enabled or trapped_enemy != null
