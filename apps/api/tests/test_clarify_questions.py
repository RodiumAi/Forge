"""LLM-generated clarify questionnaires must be sanitized before persisting.

The model output rides straight into clarify_json and back to the browser:
malformed items, duplicate ids, single-option questions or a 30-question dump
would break the wizard. The static-template fallback keeps the flow alive
when the LLM output is unusable.
"""

import typing

from app.services.orchestration.planner import (
    MAX_CLARIFY_QUESTIONS,
    format_answers_for_prompt,
    sanitize_clarify_questions,
)


def q(i: int, options: int = 3) -> dict:
    return {
        "id": f"q_{i}",
        "prompt": f"Question {i}?",
        "options": [{"id": f"o{j}", "label": f"Choice {j}"} for j in range(options)],
    }


class TestSanitize:
    def test_valid_questions_pass_through(self):
        out = sanitize_clarify_questions([q(1), q(2)])
        assert [item["id"] for item in out] == ["q_1", "q_2"]
        assert out[0]["options"][0] == {"id": "o0", "label": "Choice 0"}

    def test_caps_at_ten_questions(self):
        out = sanitize_clarify_questions([q(i) for i in range(20)])
        assert len(out) == MAX_CLARIFY_QUESTIONS

    def test_drops_questions_with_fewer_than_two_options(self):
        out = sanitize_clarify_questions([q(1, options=1), q(2)])
        assert [item["id"] for item in out] == ["q_2"]

    def test_slugs_ids_and_deduplicates(self):
        raw = [
            {"id": "Dev Name!", "prompt": "Name?", "options": ["Alice", "Bob"]},
            {"id": "dev_name_", "prompt": "Other?", "options": ["X", "Y"]},
        ]
        out = sanitize_clarify_questions(raw)
        assert out[0]["id"] == "dev_name"
        assert len({item["id"] for item in out}) == len(out)

    def test_string_options_are_accepted(self):
        out = sanitize_clarify_questions([{"prompt": "Tone?", "options": ["Sober", "Playful"]}])
        assert out[0]["options"][0]["label"] == "Sober"

    def test_garbage_yields_empty(self):
        assert sanitize_clarify_questions("not a list") == []
        assert sanitize_clarify_questions([{"prompt": ""}, 42, None]) == []


class TestAnswersFormatting:
    QUESTIONS: typing.ClassVar[list[dict]] = [q(1)]

    def test_option_answers_resolve_to_labels(self):
        block = format_answers_for_prompt({"q_1": "o1"}, self.QUESTIONS)
        assert "Choice 1" in block

    def test_free_text_answers_pass_verbatim(self):
        # The wizard lets the user type a custom answer instead of picking an
        # option; the raw text must reach the plan prompt untouched.
        block = format_answers_for_prompt({"q_1": "Alexandre Mercier"}, self.QUESTIONS)
        assert "Alexandre Mercier" in block
