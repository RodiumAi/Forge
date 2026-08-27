# Design charter

## Template
- id: mono-journal
- name: Monochrome Journal

## Colors
- --bg: #ffffff
- --fg: #0a0a0a
- --muted: #737373
- --accent: #dc2626

## Tone
Literary, austere, precise. Serif body, hairline rules, drop caps, generous margins. The red accent appears at most once per viewport (issue number, hover states, one underline).

## Do / Don't
- Do keep pure black on pure white — no grays for large surfaces.
- Do use horizontal hairline rules (1px) to structure the page, editorial multi-column text, numbered article lists with dates.
- Do keep the full-page pull quote section.
- Don't add colors beyond the single red accent, used sparingly.
- Don't use more than the 1-2 approved photos, and always in grayscale (CSS filter).

## Images
- Essay photo: https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=70 (library shelves)
- Portrait: https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=70 (open book)

Reuse these Unsplash URLs; do not hotlink other domains. Apply `filter: grayscale(1)`.
