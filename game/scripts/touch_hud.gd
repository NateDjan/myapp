extends CanvasLayer
## Virtual stick (local gui coords) + jump/shoot buttons. F3 from Main toggles debug_force_touch.

var _root: Control
var _stick_base: Panel
var _stick_knob: Panel
var _stick_radius: float = 58.0
var _stick_track_idx: int = -1
var debug_force_touch: bool = false


func _ready() -> void:
	layer = 21
	hide()
	_build()


func set_gameplay_active(on: bool) -> void:
	visible = on and _should_show()
	if not visible and TouchInput:
		TouchInput.clear_stick()
		_reset_knob()


func toggle_debug_touch() -> void:
	debug_force_touch = not debug_force_touch


func _should_show() -> bool:
	if debug_force_touch:
		return true
	if DisplayServer.is_touchscreen_available():
		return true
	if OS.has_feature("android") or OS.has_feature("ios"):
		return true
	if ProjectSettings.has_setting("game/force_touch_hud"):
		return bool(ProjectSettings.get_setting("game/force_touch_hud", false))
	return false


func _stick_gui(event: InputEvent) -> void:
	if TouchInput == null:
		return
	if event is InputEventScreenTouch:
		var st := event as InputEventScreenTouch
		if st.pressed:
			_stick_track_idx = st.index
			_apply_local(st.position)
		else:
			if st.index == _stick_track_idx:
				_stick_track_idx = -1
				TouchInput.set_stick_axis(0.0)
				_reset_knob()
	elif event is InputEventScreenDrag:
		var sd := event as InputEventScreenDrag
		if sd.index == _stick_track_idx:
			_apply_local(sd.position)


func _apply_local(local_pt: Vector2) -> void:
	var c := _stick_base.size * 0.5
	var d: Vector2 = local_pt - c
	var lim := _stick_radius
	if d.length() > lim:
		d = d.normalized() * lim
	_stick_knob.position = c + d - _stick_knob.size * 0.5
	TouchInput.set_stick_axis(d.x / lim)


func _reset_knob() -> void:
	if _stick_knob and _stick_base:
		_stick_knob.position = _stick_base.size * 0.5 - _stick_knob.size * 0.5


func _build() -> void:
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)

	_stick_base = Panel.new()
	_stick_base.custom_minimum_size = Vector2(176, 176)
	_stick_base.mouse_filter = Control.MOUSE_FILTER_STOP
	_stick_base.gui_input.connect(_stick_gui)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.09, 0.12, 0.62)
	sb.corner_radius_top_left = 88
	sb.corner_radius_top_right = 88
	sb.corner_radius_bottom_right = 88
	sb.corner_radius_bottom_left = 88
	_stick_base.add_theme_stylebox_override("panel", sb)
	_root.add_child(_stick_base)

	_stick_knob = Panel.new()
	_stick_knob.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_stick_knob.custom_minimum_size = Vector2(52, 52)
	var kn := StyleBoxFlat.new()
	kn.bg_color = Color(0.35, 1.0, 0.92, 0.9)
	kn.corner_radius_top_left = 26
	kn.corner_radius_top_right = 26
	kn.corner_radius_bottom_right = 26
	kn.corner_radius_bottom_left = 26
	_stick_knob.add_theme_stylebox_override("panel", kn)
	_stick_base.add_child(_stick_knob)
	call_deferred("_layout_controls")
	_reset_knob()

	var shoot := Button.new()
	shoot.text = "SHOOT"
	shoot.name = "ShootBtn"
	shoot.custom_minimum_size = Vector2(128, 54)
	shoot.add_theme_font_size_override("font_size", 18)
	shoot.button_down.connect(func() -> void:
		if TouchInput:
			TouchInput.pulse_shoot()
	)
	_root.add_child(shoot)

	var jump := Button.new()
	jump.text = "JUMP"
	jump.name = "JumpBtn"
	jump.custom_minimum_size = Vector2(128, 54)
	jump.add_theme_font_size_override("font_size", 18)
	jump.button_down.connect(func() -> void:
		if TouchInput:
			TouchInput.pulse_jump()
	)
	_root.add_child(jump)


func _layout_controls() -> void:
	if _stick_base == null or _root == null:
		return
	var vs := get_viewport().get_visible_rect().size
	_stick_base.position = Vector2(16, vs.y - 196)
	var shoot: Button = _root.get_node_or_null("ShootBtn") as Button
	var jump: Button = _root.get_node_or_null("JumpBtn") as Button
	if shoot:
		shoot.position = Vector2(vs.x - shoot.custom_minimum_size.x - 20, vs.y - 220)
	if jump:
		jump.position = Vector2(vs.x - jump.custom_minimum_size.x - 20, vs.y - 140)


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_SIZE_CHANGED:
		call_deferred("_layout_controls")
