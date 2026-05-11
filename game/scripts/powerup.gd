extends Area2D
## Random pickups: multi shot, giant bubble, freeze, electric, slow-mo.

enum Kind { MULTI_BUBBLE, GIANT_BUBBLE, FREEZE, ELECTRIC, SLOW_MO }

@export var kind: Kind = Kind.MULTI_BUBBLE

var _colors := {
	Kind.MULTI_BUBBLE: Color(0.4, 0.95, 1.0),
	Kind.GIANT_BUBBLE: Color(1.0, 0.55, 0.95),
	Kind.FREEZE: Color(0.65, 0.85, 1.0),
	Kind.ELECTRIC: Color(1.0, 0.95, 0.35),
	Kind.SLOW_MO: Color(0.55, 1.0, 0.55),
}


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	area_entered.connect(_on_area_entered)
	collision_layer = 16 # pickup layer 5
	collision_mask = 2 # player
	_refresh_visual()


static func random_kind(rng: RandomNumberGenerator) -> Kind:
	var pool = [
		Kind.MULTI_BUBBLE,
		Kind.GIANT_BUBBLE,
		Kind.FREEZE,
		Kind.ELECTRIC,
		Kind.SLOW_MO,
	]
	return pool[rng.randi() % pool.size()]


func setup_random(rng: RandomNumberGenerator) -> void:
	kind = random_kind(rng)
	_refresh_visual()


func _refresh_visual() -> void:
	var poly := get_node_or_null("Polygon2D") as Polygon2D
	if poly:
		poly.color = _colors.get(kind, Color.WHITE)
		poly.modulate.a = 0.95


func _on_body_entered(body: Node) -> void:
	if body.is_in_group("player"):
		_collect(body)


func _on_area_entered(area: Area2D) -> void:
	var p := area.get_parent()
	if p and p.is_in_group("player"):
		_collect(p)


func _collect(player: Node) -> void:
	if player.has_method("apply_powerup"):
		player.call("apply_powerup", int(kind))
	if ArcadeSfx:
		ArcadeSfx.play_powerup()
	queue_free()
