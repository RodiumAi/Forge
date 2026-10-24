"""Project kinds the instance offers (registry in ``app/kinds``)."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.kinds import all_kinds, kind_enabled
from app.schemas import KindOut

router = APIRouter(prefix="/kinds", tags=["kinds"])


@router.get("", response_model=list[KindOut])
def list_kinds() -> JSONResponse:
    """Public: the create screens read it to know which kinds are switched on."""
    payload = [
        KindOut(
            id=kind.id,
            engine=kind.engine,
            editor=kind.editor,
            exports=list(kind.exports),
            publish=kind.publish,
            enabled=kind_enabled(kind.id),
        ).model_dump()
        for kind in all_kinds()
    ]
    return JSONResponse(content=payload, headers={"Cache-Control": "public, max-age=60"})
