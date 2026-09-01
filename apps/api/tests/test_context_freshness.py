"""The full-content prompt layer must reflect the CURRENT files on disk.

Visual edits (text/image tools) write straight to disk without a chat message.
Keyword-based selection could miss those files, so the model — instructed to
emit complete file contents — regenerated them from stale conversation memory
and silently reverted the user's manual changes (e.g. a renamed hero, a
replaced image). Freshest-on-disk files and the plan task's declared files are
now forced into the layer.
"""

import os
import time
import typing

from app.services.filesystem import write_file
from app.services.orchestration.context import (
    _selected_file_blocks,
    merge_context_paths,
    recent_disk_paths,
    select_files,
)


def _seed(project: str, spec: dict[str, str]) -> dict[str, str]:
    for path, content in spec.items():
        write_file(project, path, content)
    return spec


class TestRecentDiskPaths:
    def test_newest_files_come_first(self, project):
        files = _seed(
            project,
            {
                "src/Old.tsx": "old",
                "src/Mid.tsx": "mid",
                "src/Hero.tsx": "hero edited by hand",
            },
        )
        from app.services.filesystem import project_dir

        now = time.time()
        os.utime(project_dir(project) / "src" / "Old.tsx", (now - 300, now - 300))
        os.utime(project_dir(project) / "src" / "Mid.tsx", (now - 100, now - 100))
        os.utime(project_dir(project) / "src" / "Hero.tsx", (now, now))
        assert recent_disk_paths(project, files)[0] == "src/Hero.tsx"

    def test_non_source_files_are_ignored(self, project):
        files = _seed(project, {"public/photo.png.html": "x", "notes.md": "y", "src/A.tsx": "z"})
        got = recent_disk_paths(project, files)
        assert "notes.md" not in got


class TestMergeContextPaths:
    FILES: typing.ClassVar[dict[str, str]] = {
        "src/A.tsx": "",
        "src/B.tsx": "",
        "src/Hero.tsx": "",
        "src/index.css": "",
    }

    def test_task_focus_files_are_guaranteed_first(self):
        got = merge_context_paths(["src/A.tsx"], ["src/B.tsx"], [], self.FILES)
        assert got[0] == "src/B.tsx"
        assert "src/A.tsx" in got

    def test_recently_edited_files_are_included_even_when_unselected(self):
        # The bug scenario: user asks for a contact-form change, selection picks
        # Contact-ish files, but the hand-edited Hero must still ride along.
        got = merge_context_paths(["src/A.tsx"], None, ["src/Hero.tsx"], self.FILES)
        assert "src/Hero.tsx" in got

    def test_deduplicates_and_drops_unknown_paths(self):
        got = merge_context_paths(["src/A.tsx", "src/A.tsx"], ["missing.tsx"], ["src/A.tsx"], self.FILES)
        assert got == ["src/A.tsx"]


class TestPromptWording:
    def test_full_blocks_declare_themselves_authoritative(self):
        text = _selected_file_blocks({"src/A.tsx": "const a = 1;"}, ["src/A.tsx"])
        assert "CURRENT on-disk state" in text
        assert "OVERRIDE" in text

    def test_system_prompt_forbids_rewriting_unseen_files(self):
        from app.prompts.system import SYSTEM_PROMPT

        assert "never revert user edits" in SYSTEM_PROMPT
        assert "NEVER rewrite a file whose full current content is NOT in this prompt" in SYSTEM_PROMPT


class TestSelectFilesStillWorks:
    def test_keyword_selection_unchanged(self):
        files = {
            "src/Contact.tsx": "contact form phone",
            "src/Hero.tsx": "hero title",
            "src/index.css": "body{}",
        }
        got = select_files("add a phone field to the contact form", files, k=4)
        assert "src/Contact.tsx" in got
