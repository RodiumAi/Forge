from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def _read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_deployments_only_consume_a_successful_main_ci_sha():
    for relative in (
        ".github/workflows/deploy-api.yml",
        ".github/workflows/deploy-gateway.yml",
    ):
        workflow = _read(relative)
        assert "workflow_run:" in workflow
        assert 'workflows: ["CI"]' in workflow
        assert "branches: [main]" in workflow
        assert "workflow_dispatch:" not in workflow
        assert "github.event.workflow_run.conclusion == 'success'" in workflow
        assert "github.event.workflow_run.head_branch == 'main'" in workflow
        assert "ref: ${{ github.event.workflow_run.head_sha }}" in workflow
        assert "IMAGE_TAG: ${{ github.event.workflow_run.head_sha }}" in workflow


def test_api_delivery_scans_the_exact_image_before_push():
    workflow = _read(".github/workflows/deploy-api.yml")
    scan = workflow.index("Scan built image for fixable vulnerabilities")
    push = workflow.index("Push verified API image")
    assert scan < push
    assert "image --scanners vuln" in workflow
    assert "--severity CRITICAL,HIGH" in workflow
    assert "--exit-code 1" in workflow
    assert "image --format cyclonedx" in workflow
    assert "forge-api-trivy.json" in workflow


def test_runtime_image_is_locked_and_non_root():
    dockerfile = _read("apps/api/Dockerfile")
    assert "pip install --no-cache-dir --require-hashes -r requirements.txt" in dockerfile
    assert "useradd --uid 1000 --gid 1000" in dockerfile
    assert "USER forge:forge" in dockerfile
    assert dockerfile.index("USER forge:forge") < dockerfile.index('CMD ["uvicorn"')


def test_runtime_dependency_lock_is_exact_and_has_hashes():
    lock = _read("apps/api/requirements.txt")
    declarations = [
        line
        for line in lock.splitlines()
        if line and not line[0].isspace() and not line.startswith(("#", "--"))
    ]
    assert declarations
    assert all(re.match(r"^[a-z0-9][a-z0-9._-]*==[^ ;]+(?: ; .+)? \\$", line) for line in declarations)
    assert lock.count("--hash=sha256:") >= len(declarations)
    assert "pyjwt==" in lock
    assert "python-jose==" not in lock
    assert "\necdsa==" not in lock
