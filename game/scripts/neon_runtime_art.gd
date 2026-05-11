extends RefCounted
## CPU-generated soft blobs so builds ship without PNG dependencies.


static var _cache: Dictionary = {}


static func soft_blob(size: Vector2i, core: Color, rim: Color, key: String) -> ImageTexture:
	if _cache.has(key):
		return _cache[key]
	var img := Image.create(size.x, size.y, false, Image.FORMAT_RGBA8)
	var cx := float(size.x) * 0.5
	var cy := float(size.y) * 0.5
	var r := mini(size.x, size.y) * 0.42
	for y in size.y:
		for x in size.x:
			var d := Vector2(float(x) - cx, float(y) - cy).length()
			var t := clampf(1.0 - d / r, 0.0, 1.0)
			var c := rim.lerp(core, sqrt(t))
			c.a = smoothstep(0.0, 1.0, t)
			img.set_pixel(x, y, c)
	var tex := ImageTexture.create_from_image(img)
	_cache[key] = tex
	return tex


static func attach_blob_sprite(poly: Polygon2D, cache_key: String) -> void:
	if poly == null:
		return
	var p: Node = poly.get_parent()
	if p == null:
		return
	if p.get_node_or_null("NeonSprite"):
		return
	var col := poly.color
	var tex := soft_blob(Vector2i(72, 88), col.lightened(0.25), col.darkened(0.15), cache_key)
	var spr := Sprite2D.new()
	spr.name = "NeonSprite"
	spr.texture = tex
	spr.position = poly.position
	spr.scale = Vector2(0.42, 0.52)
	p.add_child(spr)
	p.move_child(spr, poly.get_index())
	poly.visible = false


static func attach_bubble_sprite(poly: Polygon2D, cache_key: String) -> void:
	if poly == null:
		return
	var p := poly.get_parent()
	if p == null or p.get_node_or_null("NeonSprite"):
		return
	var col := poly.color
	var tex := soft_blob(Vector2i(80, 80), Color.WHITE.lerp(col, 0.35), col, cache_key)
	var spr := Sprite2D.new()
	spr.name = "NeonSprite"
	spr.texture = tex
	spr.scale = Vector2(0.48, 0.48)
	p.add_child(spr)
	p.move_child(spr, poly.get_index())
	poly.visible = false
