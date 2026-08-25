"""Seed + constants for the model catalog (Gemini-first, gpt-image-2 for image tests)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import ModelCatalog

# Stable seed — no timestamps. Order is deterministic.
CATALOG_SEED: list[dict] = [
    {
        "slug": "google/gemini-3.1-flash-lite",
        "provider": "google",
        "tier": "lite",
        "role": "text",
        "status": "active",
        "context_tokens": 1_000_000,
        "max_output_tokens": 64_000,
        "price_in_per_m": 0.25,
        "price_out_per_m": 1.50,
    },
    {
        "slug": "google/gemini-3.7-flash",
        "provider": "google",
        "tier": "primary",
        "role": "text",
        "status": "active",
        "context_tokens": 1_000_000,
        "max_output_tokens": 64_000,
        "price_in_per_m": 0.75,
        "price_out_per_m": 3.75,
    },
    {
        "slug": "google/gemini-3.1-pro",
        "provider": "google",
        "tier": "escalation",
        "role": "text",
        "status": "active",
        "context_tokens": 1_000_000,
        "max_output_tokens": 64_000,
        "price_in_per_m": 2.0,
        "price_out_per_m": 12.0,
    },
    {
        "slug": "openai/gpt-image-2",
        "provider": "openai",
        "tier": "primary",
        "role": "image",
        "status": "active",
        "context_tokens": 0,
        "max_output_tokens": 0,
        "price_in_per_m": None,
        "price_out_per_m": None,
    },
    {
        "slug": "google/gemini-3.1-flash-image",
        "provider": "google",
        "tier": "primary",
        "role": "image",
        "status": "standby",
        "context_tokens": 0,
        "max_output_tokens": 0,
        "price_in_per_m": None,
        "price_out_per_m": None,
    },
    {
        "slug": "google/gemini-3-pro-image",
        "provider": "google",
        "tier": "quality",
        "role": "image",
        "status": "standby",
        "context_tokens": 0,
        "max_output_tokens": 0,
        "price_in_per_m": None,
        "price_out_per_m": None,
    },
    {
        "slug": "openai/gpt-5.6-terra",
        "provider": "openai",
        "tier": "standby",
        "role": "text",
        "status": "standby",
        "context_tokens": 1_000_000,
        "max_output_tokens": 64_000,
        "price_in_per_m": 2.0,
        "price_out_per_m": 12.0,
    },
]


def seed_model_catalog(db: Session) -> None:
    for row in CATALOG_SEED:
        existing = db.get(ModelCatalog, row["slug"])
        if existing is None:
            db.add(ModelCatalog(**row))
        else:
            for key, value in row.items():
                if key == "slug":
                    continue
                setattr(existing, key, value)
    db.commit()
