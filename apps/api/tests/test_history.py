"""Project history: snapshots must be safe, and restore must not destroy work."""

import pytest

from app.services import history
from app.services.filesystem import list_files, read_file, write_file

pytestmark = pytest.mark.skipif(not history.is_available(), reason="git is not installed")


class TestSnapshot:
    def test_first_snapshot_captures_the_workspace(self, project):
        write_file(project, "src/App.tsx", "v1")
        snap = history.snapshot(project, "initial scaffold")
        assert snap
        assert [s.label for s in history.list_snapshots(project)] == ["initial scaffold"]

    def test_returns_none_when_nothing_changed(self, project):
        write_file(project, "src/App.tsx", "v1")
        history.snapshot(project, "init")
        # No empty checkpoints should pollute the timeline.
        assert history.snapshot(project, "again") is None

    def test_records_each_change(self, project):
        write_file(project, "src/App.tsx", "v1")
        history.snapshot(project, "init")
        write_file(project, "src/App.tsx", "v2")
        assert history.snapshot(project, "edit")
        assert [s.label for s in history.list_snapshots(project)] == ["edit", "init"]

    def test_lists_the_files_a_snapshot_touched(self, project):
        write_file(project, "src/App.tsx", "v1")
        history.snapshot(project, "init")
        write_file(project, "src/New.tsx", "x")
        snap = history.snapshot(project, "add")
        assert history.snapshot_files(project, snap) == ["src/New.tsx"]

    def test_never_raises_on_an_unusable_project(self, monkeypatch, project):
        # History is best effort: it must never block a legitimate write.
        monkeypatch.setattr(history, "_git_exe", lambda: None)
        assert history.snapshot(project, "x") is None


class TestRestore:
    def test_reverts_content_and_removes_new_files(self, project):
        write_file(project, "src/App.tsx", "v1")
        first = history.snapshot(project, "init")

        write_file(project, "src/App.tsx", "v2 broken")
        write_file(project, "src/Extra.tsx", "junk")
        history.snapshot(project, "bad turn")

        history.restore(project, first)
        assert read_file(project, "src/App.tsx") == "v1"
        assert sorted(list_files(project)) == ["src/App.tsx"]

    def test_is_forward_only_so_the_undo_is_itself_undoable(self, project):
        write_file(project, "src/App.tsx", "v1")
        first = history.snapshot(project, "init")
        write_file(project, "src/App.tsx", "v2")
        history.snapshot(project, "edit")

        history.restore(project, first)
        labels = [s.label for s in history.list_snapshots(project)]
        # Nothing is rewritten: the old states stay reachable.
        assert "edit" in labels
        assert "init" in labels
        assert labels[0].startswith("restore checkpoint")

    def test_checkpoints_uncommitted_work_before_restoring(self, project):
        write_file(project, "src/App.tsx", "v1")
        first = history.snapshot(project, "init")
        write_file(project, "src/App.tsx", "v2")
        history.snapshot(project, "edit")
        # Unsaved-to-history change, made just before the restore.
        write_file(project, "src/App.tsx", "v3 manual")

        history.restore(project, first)
        assert "before restore" in [s.label for s in history.list_snapshots(project)]

    def test_rejects_an_unknown_snapshot_id(self, project):
        write_file(project, "src/App.tsx", "v1")
        history.snapshot(project, "init")
        with pytest.raises(history.HistoryUnavailable):
            history.restore(project, "0" * 40)


class TestIsolation:
    def test_the_internal_gitignore_is_hidden_from_the_project(self, project):
        write_file(project, "src/App.tsx", "v1")
        history.snapshot(project, "init")
        assert ".gitignore" not in list_files(project)
        assert ".git" not in list_files(project)
