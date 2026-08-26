"""Public plugin catalog API (read-only)."""

from fastapi import APIRouter, Request

from app.i18n import resolve_locale
from app.plugins_catalog import FAMILY_ORDER, PLUGINS
from app.schemas import PluginFamilyOut, PluginOut, PluginsCatalogOut

router = APIRouter(prefix="/plugins", tags=["plugins"])


@router.get("", response_model=PluginsCatalogOut)
def list_plugins(request: Request) -> PluginsCatalogOut:
    locale = resolve_locale(request)
    items = [
        PluginOut(
            id=p.id,
            family=p.family,
            package=p.package,
            version=p.version,
            when_to_use=p.when_to_use_fr if locale == "fr" else p.when_to_use_en,
            import_example=p.import_example,
            forbidden_alternatives=list(p.forbidden_alternatives),
            installable=p.installable,
        )
        for p in PLUGINS
    ]
    families = [
        PluginFamilyOut(
            id=fid,
            plugins=[i for i in items if i.family == fid],
        )
        for fid in FAMILY_ORDER
    ]
    return PluginsCatalogOut(families=families, plugins=items)
