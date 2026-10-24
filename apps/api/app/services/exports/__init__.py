"""Exports and publication of the Forge Design document kinds (slides first).

- ``bundle``: the standalone deck player, built with esbuild from the web
  app's ``components/deck-player`` by ``runtime/deck/build.mjs``.
- ``deck_source``: deck, slides, notes and theme read from a project and
  checked against the contracts.
- ``deck_site``: the static player site (published link, single-file HTML,
  and the print page the PDF, PNG and PPTX exports render).
- ``render``: Chromium in a child process with a time budget (PDF, PNG, and
  the layout read for the PPTX).
- ``pptx``: native PowerPoint file through ``runtime/deck/pptx.mjs``.
- ``gating``: which plan may export what, and the "Made with Forge" badge.
"""
