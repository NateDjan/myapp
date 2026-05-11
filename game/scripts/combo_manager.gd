extends Node
## Tracks streak-based multiplier and total score.

signal combo_changed(multiplier: int, streak: int)
signal score_changed(total: int)

var score: int = 0
var multiplier: int = 1
var streak: int = 0
var streak_decay_sec: float = 2.2
var _decay_timer: float = 0.0


func _process(delta: float) -> void:
	if streak > 0:
		_decay_timer += delta
		if _decay_timer >= streak_decay_sec:
			reset_combo()


func register_pop(base_points: int = 12) -> int:
	streak += 1
	_decay_timer = 0.0
	multiplier = mini(16, 1 + streak / 2)
	var pts := base_points * multiplier
	score += pts
	score_changed.emit(score)
	combo_changed.emit(multiplier, streak)
	return pts


func reset_combo() -> void:
	streak = 0
	multiplier = 1
	_decay_timer = 0.0
	combo_changed.emit(multiplier, streak)


func reset_run() -> void:
	score = 0
	reset_combo()
	score_changed.emit(score)
