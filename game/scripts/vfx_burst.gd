extends RefCounted
## Simple radial burst using a multi-point Line2D + tween fade.


static func spawn(root: Node, world_pos: Vector2, col: Color) -> void:
	var n := Node2D.new()
	n.global_position = world_pos
	root.add_child(n)
	var line := Line2D.new()
	line.width = 3.0
	line.default_color = col
	var pts: PackedVector2Array = []
	var rays := 14
	for i in rays:
		var a := TAU * float(i) / float(rays)
		pts.append(Vector2.ZERO)
		pts.append(Vector2(cos(a), sin(a)) * 48.0)
	line.points = pts
	n.add_child(line)
	var tw := n.create_tween()
	tw.tween_property(line, "modulate:a", 0.0, 0.22).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.finished.connect(n.queue_free)
