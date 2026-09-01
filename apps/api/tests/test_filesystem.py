"""Filesystem safety: atomic writes, path escapes, binary detection, versions."""

import pytest

from app.services.filesystem import (
    BinaryFileError,
    content_version,
    delete_file,
    file_tree,
    list_files,
    project_dir,
    read_file,
    rename_path,
    safe_resolve,
    write_bytes,
    write_file,
)


class TestPathSafety:
    @pytest.mark.parametrize(
        "relative",
        ["../evil.txt", "../../etc/passwd", "src/../../out.txt"],
    )
    def test_refuses_paths_escaping_the_project(self, project, relative):
        with pytest.raises(ValueError, match="escapes project root"):
            safe_resolve(project, relative)

    def test_allows_nested_paths(self, project):
        assert safe_resolve(project, "src/components/Button.tsx")


class TestReadWrite:
    def test_round_trips_utf8(self, project):
        write_file(project, "src/App.tsx", "const x = 'é à ü';")
        assert read_file(project, "src/App.tsx") == "const x = 'é à ü';"

    def test_creates_parent_directories(self, project):
        write_file(project, "a/b/c/deep.tsx", "x")
        assert read_file(project, "a/b/c/deep.tsx") == "x"

    def test_raises_binary_error_instead_of_a_decode_crash(self, project):
        # Opening a PNG from the file tree used to bubble up as a raw 500.
        write_bytes(project, "public/logo.png", b"\x89PNG\r\n\x1a\n\xff\xfe binary")
        with pytest.raises(BinaryFileError):
            read_file(project, "public/logo.png")

    def test_reports_a_missing_file(self, project):
        with pytest.raises(FileNotFoundError):
            read_file(project, "nope.txt")


class TestContentVersion:
    def test_changes_when_the_content_changes(self, project):
        write_file(project, "src/App.tsx", "v1")
        first = content_version(project, "src/App.tsx")
        write_file(project, "src/App.tsx", "v2")
        assert content_version(project, "src/App.tsx") != first

    def test_is_stable_for_identical_content(self, project):
        write_file(project, "a.tsx", "same")
        first = content_version(project, "a.tsx")
        write_file(project, "a.tsx", "same")
        assert content_version(project, "a.tsx") == first

    def test_is_empty_for_a_missing_file(self, project):
        assert content_version(project, "nope.tsx") == ""


class TestListing:
    def test_hides_internal_and_vendored_paths(self, project):
        write_file(project, "src/App.tsx", "x")
        write_file(project, "node_modules/pkg/index.js", "x")
        write_file(project, "dist/bundle.js", "x")
        write_file(project, ".gitignore", "node_modules/")
        assert sorted(list_files(project)) == ["src/App.tsx"]

    def test_file_tree_hides_the_same_paths(self, project):
        write_file(project, "src/App.tsx", "x")
        write_file(project, "node_modules/pkg/index.js", "x")
        write_file(project, ".gitignore", "x")
        assert [n.path for n in file_tree(project)] == ["src"]

    def test_skips_binary_files_in_list_files(self, project):
        write_file(project, "src/App.tsx", "x")
        write_bytes(project, "src/logo.png", b"\xff\xfe\x00binary")
        assert sorted(list_files(project)) == ["src/App.tsx"]


class TestDelete:
    def test_removes_a_file(self, project):
        write_file(project, "src/App.tsx", "x")
        delete_file(project, "src/App.tsx")
        assert list_files(project) == {}

    def test_removes_a_directory_recursively(self, project):
        write_file(project, "src/ui/a.tsx", "x")
        write_file(project, "src/ui/b.tsx", "x")
        delete_file(project, "src/ui")
        assert list_files(project) == {}

    def test_refuses_to_delete_the_project_root(self, project):
        write_file(project, "src/App.tsx", "x")
        with pytest.raises(ValueError, match="project root"):
            delete_file(project, "")

    def test_refuses_to_delete_the_history_repo(self, project):
        write_file(project, "src/App.tsx", "x")
        with pytest.raises(ValueError, match="history"):
            delete_file(project, ".git")


class TestPublicAssets:
    """Files under public/ are served to the builder (favicon, OG image).

    They used to be reachable only through the Vite preview proxy, which no
    longer exists; the builder rendered broken images until a dedicated route
    replaced it.
    """

    def test_scaffold_ships_a_favicon(self, project):
        from app.services.scaffold import scaffold_vite_react

        scaffold_vite_react(project, "Demo")
        favicon = project_dir(project) / "public" / "favicon.png"
        assert favicon.is_file()
        assert favicon.stat().st_size > 0

    def test_public_files_resolve_under_the_project_root(self, project):
        write_bytes(project, "public/favicon.png", b"\x89PNG\r\n\x1a\n")
        root = project_dir(project).resolve()
        target = (root / "public" / "favicon.png").resolve()
        assert target.is_file()
        assert target.relative_to(root)


class TestRename:
    def test_renames_a_file(self, project):
        write_file(project, "src/Old.tsx", "x")
        rename_path(project, "src/Old.tsx", "src/New.tsx")
        assert sorted(list_files(project)) == ["src/New.tsx"]

    def test_creates_missing_target_directories(self, project):
        write_file(project, "src/Old.tsx", "x")
        rename_path(project, "src/Old.tsx", "src/ui/New.tsx")
        assert sorted(list_files(project)) == ["src/ui/New.tsx"]

    def test_refuses_an_existing_target(self, project):
        write_file(project, "a.tsx", "1")
        write_file(project, "b.tsx", "2")
        with pytest.raises(FileExistsError):
            rename_path(project, "a.tsx", "b.tsx")
        assert read_file(project, "b.tsx") == "2"

    def test_reports_a_missing_source(self, project):
        with pytest.raises(FileNotFoundError):
            rename_path(project, "nope.tsx", "a.tsx")

    def test_refuses_to_escape_the_project(self, project):
        write_file(project, "a.tsx", "x")
        with pytest.raises(ValueError, match="escapes project root"):
            rename_path(project, "a.tsx", "../evil.tsx")

    def test_refuses_to_touch_history(self, project):
        write_file(project, "a.tsx", "x")
        with pytest.raises(ValueError, match="history"):
            rename_path(project, "a.tsx", ".git/config")

    def test_refuses_to_move_a_directory_into_itself(self, project):
        write_file(project, "src/ui/a.tsx", "x")
        with pytest.raises(ValueError, match="inside itself"):
            rename_path(project, "src/ui", "src/ui/nested")
