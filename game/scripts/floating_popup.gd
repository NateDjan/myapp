extends RefCounted
## Short-lived combo / points feedback.


static func spawn(root: Node, at: Vector2, text: String, color: Color = Color.WHITE) -> void:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.modulate = color
	l.global_position = at + Vector2(-40, -36)
	l.z_index = 50
	l.add_theme_font_size_override("font_size", 22)
	root.add_child(l)
	var tw := l.create_tween()
	tw.set_parallel(true)
	var end_pos := l.global_position + Vector2(0, -70)
	tw.tween_property(l, "global_position", end_pos, 0.55).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "modulate:a", 0.0, 0.55).set_delay(0.12)
	tw.finished.connect(l.queue_free)
