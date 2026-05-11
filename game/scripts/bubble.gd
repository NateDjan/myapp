extends CharacterBody2D
## Energy bubble: traps first enemy hit, floats upward, acts as temporary platform.

const _NeonArt := preload("res://scripts/neon_runtime_art.gd")

signal enemy_trapped(bubble: Node, enemy: Node)
signal bubble_popped(bubble: Node, world_pos: Vector2)

const FLOAT_SPEED := 46.0
const ENEMY_STATE_BUBBLED := 2 # keep in sync with enemy.gd State enum order

var dir: Vector2 = Vector2.RIGHT
var speed: float = 360.0
var electric: bool = false
var trapped_enemy: Node = null
var _alive: bool = true
var _platform_enabled: bool = false

@onready var collider: CollisionShape2D = $CollisionShape2D
@onready var visual: Polygon2D = $Polygon2D


func _ready() -> void:
	add_to_group("bubbles")
	collision_layer = 8 # layer 4 bubble
	collision_mask = 1 + 4 # world + enemy
	if visual:
		visual.color = Color(0.35, 1.0, 0.92, 0.75)
	_NeonArt.attach_bubble_sprite(visual, "bubble_base")
	var lm := get_tree().current_scene.get_node_or_null("GameWorld/World/LevelManager")
	if lm and lm.has_method("_on_bubble_trapped"):
		enemy_trapped.connect(lm._on_bubble_trapped)


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
		scale = Vector2(1.75, 1.75)
		speed *= 0.92
	if visual:
		visual.color = visual.color.lerp(Color(1.0, 0.55, 0.95), 0.35 if giant else 0.0)
		if electric:
			visual.color = Color(1.0, 0.95, 0.35, 0.85)
	var spr := get_node_or_null("NeonSprite") as Sprite2D
	if spr:
		spr.modulate = visual.color


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
	# Stop the round body from snagging the player; ride only the one-way plate.
	collision_layer = 0
	if collider:
		collider.disabled = true
	var plate := StaticBody2D.new()
	plate.name = "RidePlate"
	plate.collision_layer = 8
	plate.collision_mask = 0
	var cs := CollisionShape2D.new()
	var sh := RectangleShape2D.new()
	sh.size = Vector2(54.0 * scale.x, 12.0)
	cs.shape = sh
	cs.one_way_collision = true
	cs.position = Vector2(0, -11.0 * scale.y)
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
