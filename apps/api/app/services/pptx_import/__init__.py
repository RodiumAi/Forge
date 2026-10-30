"""Import of PowerPoint (.pptx) slides into a Forge deck (see ``convert``)."""

from .archive import MAX_PPTX_BYTES, PptxError
from .convert import WARNING_CODES, convert_pptx

__all__ = ["MAX_PPTX_BYTES", "WARNING_CODES", "PptxError", "convert_pptx"]
