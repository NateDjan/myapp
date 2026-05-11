extends Node2D
## Dessin procédural « briques Mario » (lisible, pas d’images).

@export var brick_size: Vector2 = Vector2(260, 22)


func _ready() -> void:
	z_index = -2
	queue_redraw()


func _draw() -> void:
	var w := brick_size.x
	var h := brick_size.y
	var tl := Vector2(-w * 0.5, -h * 0.5)
	var rect := Rect2(tl, brick_size)

	draw_rect(rect, Color(0.76, 0.44, 0.15))
	draw_rect(Rect2(tl, Vector2(w, maxf(5.0, h * 0.24))), Color(1.0, 0.88, 0.62))
	draw_rect(rect, Color(0.06, 0.04, 0.02), false, 4.0)

	var rows := maxi(2, mini(5, int(h / 8.0)))
	for r in range(1, rows):
		var yy := tl.y + float(r) * (h / float(rows))
		draw_line(Vector2(tl.x + 3, yy), Vector2(tl.x + w - 3, yy), Color(0.4, 0.22, 0.08), 2.0)

	var cols := maxi(4, int(w / 36.0))
	var cw := w / float(cols)
	for c in range(cols + 1):
		var xx := tl.x + float(c) * cw
		var shift := (c % 2) * (h * 0.22)
		draw_line(Vector2(xx, tl.y + shift + 3), Vector2(xx, tl.y + h - 3), Color(0.5, 0.28, 0.1), 1.6)
