class_name DailyChallenge
## Deterministic seed from local calendar date (YYYYMMDD).


static func seed_for_today() -> int:
	var d := Time.get_datetime_dict_from_system()
	return int(d.year) * 10000 + int(d.month) * 100 + int(d.day)
