"""Document contracts of the Forge Design kinds (slides, codelab, design system).

The JSON Schemas in ``contracts/forge-design/`` at the repo root are the source
of truth. The Pydantic models here and the Zod schemas in
``apps/web/lib/contracts/`` mirror them; both test suites validate the same
fixtures against the schema and their own models so neither side can drift.
"""

from app.contracts.forge_design import (
    Codelab,
    Deck,
    DesignSystem,
    Slide,
    validate_codelab,
    validate_deck,
    validate_design_system,
    validate_slide,
)

__all__ = [
    "Codelab",
    "Deck",
    "DesignSystem",
    "Slide",
    "validate_codelab",
    "validate_deck",
    "validate_design_system",
    "validate_slide",
]
