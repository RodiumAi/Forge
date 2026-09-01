from app.config import Settings, clear_settings_cache


def test_staging_ignores_minio_dev_defaults():
    clear_settings_cache()
    s = Settings(
        environment="staging",
        object_store_access_key="rodiumdev",
        object_store_secret_key="rodiumdev123",
        bucket_site_assets="forge-assets-prod",
    )
    assert s.resolved_object_store_credentials() == ("", "")
    assert s.object_store_enabled is True


def test_local_requires_explicit_keys():
    clear_settings_cache()
    s = Settings(
        environment="local",
        object_store_access_key="rodiumdev",
        object_store_secret_key="rodiumdev123",
        bucket_uploads="forge-uploads",
    )
    assert s.resolved_object_store_credentials() == ("rodiumdev", "rodiumdev123")
    assert s.object_store_enabled is True
