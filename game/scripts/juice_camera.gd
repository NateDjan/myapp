extends Camera2D
## Screen shake driven by trauma decay.

@export var max_offset: float = 18.0
var trauma: float = 0.0


func add_shake(amount: float) -> void:
	trauma = clampf(trauma + amount, 0.0, 1.0)


func _process(delta: float) -> void:
	trauma = move_toward(trauma, 0.0, delta * 2.4)
	if trauma <= 0.001:
		offset = Vector2.ZERO
		return
	var o := max_offset * trauma * trauma
	offset = Vector2(randf_range(-o, o), randf_range(-o, o))
