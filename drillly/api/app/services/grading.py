def grade_answer(q_type: str, content: dict, answer: dict) -> tuple[float, bool]:
    if q_type in ("coding", "subjective"):
        return 0.0, False

    expected = sorted(str(x).upper() for x in (content.get("answer") or []))
    if q_type == "single_choice":
        got = answer.get("value") or answer.get("keys") or answer.get("selected")
        if isinstance(got, list):
            got_keys = sorted(str(x).upper() for x in got)
        else:
            got_keys = [str(got).upper()] if got is not None else []
        ok = got_keys == expected[:1] if expected else False
        return (1.0 if ok else 0.0), ok

    if q_type == "multiple_choice":
        got = answer.get("value") or answer.get("keys") or answer.get("selected") or []
        if not isinstance(got, list):
            got = [got]
        got_keys = sorted(str(x).upper() for x in got)
        ok = got_keys == expected
        return (1.0 if ok else 0.0), ok

    return 0.0, False
