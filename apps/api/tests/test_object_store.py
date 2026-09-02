"""Object store endpoint normalization (S3 virtual-hosted addressing)."""

from app.providers import objects as objects_module


def test_generic_aws_endpoint_dropped_for_virtual_addressing(monkeypatch):
    monkeypatch.setenv("OBJECT_STORE_ADDRESSING", "virtual")
    monkeypatch.setenv("OBJECT_STORE_ENDPOINT", "https://s3.eu-west-1.amazonaws.com")
    objects_module.reset_object_store()
    assert objects_module._normalize_endpoint("https://s3.eu-west-1.amazonaws.com") is None


def test_minio_endpoint_kept_for_path_addressing(monkeypatch):
    monkeypatch.setenv("OBJECT_STORE_ADDRESSING", "path")
    monkeypatch.setenv("OBJECT_STORE_ENDPOINT", "http://127.0.0.1:9000")
    objects_module.reset_object_store()
    assert objects_module._normalize_endpoint("http://127.0.0.1:9000") == "http://127.0.0.1:9000"


def test_bucket_virtual_host_endpoint_kept(monkeypatch):
    monkeypatch.setenv("OBJECT_STORE_ADDRESSING", "virtual")
    endpoint = "https://forge-uploads-prod.s3.eu-west-1.amazonaws.com"
    objects_module.reset_object_store()
    assert objects_module._normalize_endpoint(endpoint) == endpoint
