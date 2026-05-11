extends Node
## Lightweight procedural blips — no binary assets required.

var _player: AudioStreamPlayer
var _playback: AudioStreamGeneratorPlayback


func _ready() -> void:
	_player = AudioStreamPlayer.new()
	add_child(_player)
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = 22050.0
	gen.buffer_length = 0.15
	_player.stream = gen
	_player.volume_db = -10.0
	_player.play()
	await get_tree().process_frame
	_playback = _player.get_stream_playback() as AudioStreamGeneratorPlayback


func play_pop(pitch_mul: float = 1.0) -> void:
	_tone(520.0 * pitch_mul, 0.06, 0.22)


func play_shoot() -> void:
	_tone(380.0, 0.04, 0.12)


func play_powerup() -> void:
	_tone(660.0, 0.08, 0.18)
	_tone(880.0, 0.06, 0.14)


func play_hurt() -> void:
	_tone(140.0, 0.12, 0.28)


func play_land() -> void:
	_tone(210.0, 0.05, 0.1)
	_tone(120.0, 0.04, 0.08)


func play_combo_spike(pitch_mul: float = 1.0) -> void:
	_tone(720.0 * pitch_mul, 0.03, 0.1)
	_tone(960.0 * pitch_mul, 0.04, 0.12)


func _tone(freq: float, duration: float, volume: float) -> void:
	if _playback == null:
		return
	var available := _playback.get_frames_available()
	if available < 8:
		return
	var gen_stream := _player.stream as AudioStreamGenerator
	var mix_rate := gen_stream.mix_rate if gen_stream else 22050.0
	var samples := mini(available, int(duration * mix_rate))
	var phase := 0.0
	var inc := TAU * freq / mix_rate
	for i in samples:
		var env := 1.0 - float(i) / float(samples)
		var s := sin(phase) * volume * env
		_playback.push_frame(Vector2(s, s))
		phase += inc
