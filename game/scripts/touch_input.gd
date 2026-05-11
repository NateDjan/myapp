extends Node
## Virtual stick + digital buttons (fed by TouchHud). Merged with keyboard in Player.

var move_axis: float = 0.0
var _jump_latch: bool = false
var _shoot_latch: bool = false


func set_stick_axis(x: float) -> void:
	move_axis = clampf(x, -1.0, 1.0)


func pulse_jump() -> void:
	_jump_latch = true


func pulse_shoot() -> void:
	_shoot_latch = true


func consume_jump() -> bool:
	if _jump_latch:
		_jump_latch = false
		return true
	return false


func consume_shoot() -> bool:
	if _shoot_latch:
		_shoot_latch = false
		return true
	return false


func clear_stick() -> void:
	move_axis = 0.0
