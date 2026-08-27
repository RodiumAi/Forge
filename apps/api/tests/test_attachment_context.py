"""Attachments must survive prompt assembly.

The final user turn used to be capped at 4000 chars like every other turn:
a long inlined .md amputated the message, and when the [Image attached: …]
markers sat past the cut the vision parts were never built — the model
answered as if nothing had been attached.
"""

from app.services.orchestration.context import (
    FINAL_USER_TURN_MAX,
    _final_user_turn,
)

MARKER = "[Image attached: mockup.png | url:http://x/m.png | object:abc | intent:reference]"


class TestFinalUserTurn:
    def test_short_messages_pass_through_untouched(self):
        assert _final_user_turn("build me a site " + MARKER) == "build me a site " + MARKER

    def test_long_documents_are_truncated_with_a_notice(self):
        text = "word " * 30_000  # ~150k chars
        out = _final_user_turn(text)
        assert len(out) < len(text)
        assert "truncated" in out

    def test_markers_past_the_cut_are_reappended(self):
        text = ("x" * (FINAL_USER_TURN_MAX + 500)) + "\n" + MARKER
        out = _final_user_turn(text)
        assert MARKER in out, "losing the marker silently drops the vision images"

    def test_markers_before_the_cut_are_not_duplicated(self):
        text = MARKER + "\n" + ("x" * (FINAL_USER_TURN_MAX + 500))
        out = _final_user_turn(text)
        assert out.count(MARKER) == 1

    def test_multiple_lost_markers_all_survive(self):
        markers = [
            f"[Image attached: shot{i}.png | url:http://x/{i}.png | object:o{i} | intent:reference]"
            for i in range(5)
        ]
        text = ("x" * (FINAL_USER_TURN_MAX + 10)) + "\n" + "\n".join(markers)
        out = _final_user_turn(text)
        for marker in markers:
            assert marker in out
