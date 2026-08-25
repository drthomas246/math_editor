#!/usr/bin/env python3
"""Render one PDF page and crop a normalized rectangle from the original PDF."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from typing import Any, NoReturn


def emit(payload: dict[str, Any], exit_code: int) -> NoReturn:
    print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    raise SystemExit(exit_code)


def fail(code: str, message: str, *, technical_message: str | None = None) -> NoReturn:
    payload: dict[str, Any] = {"ok": False, "code": code, "message": message}
    if technical_message:
        payload["technicalMessage"] = technical_message
    emit(payload, 1)


try:
    from PIL import Image, UnidentifiedImageError
except ImportError as error:  # pragma: no cover - runtime dependent
    fail(
        "AI_RUNTIME_TOOL_UNAVAILABLE",
        "PDF図版の切り出しに必要なPillowを利用できません。",
        technical_message=str(error),
    )

try:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError
except ImportError as error:  # pragma: no cover - runtime dependent
    fail(
        "AI_RUNTIME_TOOL_UNAVAILABLE",
        "PDF検査に必要なpypdfを利用できません。",
        technical_message=str(error),
    )


ALLOWED_INPUT_KEYS = {
    "pdfPath",
    "pdfPageNumber",
    "bounds",
    "rotationApplied",
    "dpi",
    "outputMimeType",
    "outputPath",
    "pdftoppmPath",
}
ALLOWED_BOUND_KEYS = {"left", "top", "right", "bottom"}
ALLOWED_ROTATIONS = {0, 90, 180, 270}
MIME_TO_FORMAT = {
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/webp": "WEBP",
}
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_EDGE = 10_000
MAX_IMAGE_PIXELS = 40_000_000


def load_request(request_path: Path) -> dict[str, Any]:
    try:
        raw = request_path.read_text(encoding="utf-8")
        value = json.loads(raw)
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        fail("AI_FIGURE_OUTPUT_INVALID", "Crop入力JSONを読み取れません。", technical_message=str(error))
    if not isinstance(value, dict):
        fail("AI_FIGURE_OUTPUT_INVALID", "Crop入力はJSON objectである必要があります。")
    unknown = sorted(set(value) - ALLOWED_INPUT_KEYS)
    if unknown:
        fail("AI_FIGURE_OUTPUT_INVALID", f"Crop入力に未知フィールドがあります: {', '.join(unknown)}")
    return value


def require_string(request: dict[str, Any], key: str) -> str:
    value = request.get(key)
    if not isinstance(value, str) or not value.strip():
        fail("AI_FIGURE_OUTPUT_INVALID", f"{key}には空でない文字列が必要です。")
    return value


def resolve_path(value: str, base_dir: Path) -> Path:
    candidate = Path(value).expanduser()
    if not candidate.is_absolute():
        candidate = base_dir / candidate
    return candidate.resolve()


def validate_bounds(value: Any) -> tuple[float, float, float, float]:
    if not isinstance(value, dict):
        fail("AI_FIGURE_OUTPUT_INVALID", "boundsはJSON objectである必要があります。")
    unknown = sorted(set(value) - ALLOWED_BOUND_KEYS)
    missing = sorted(ALLOWED_BOUND_KEYS - set(value))
    if unknown or missing:
        details = []
        if missing:
            details.append(f"不足: {', '.join(missing)}")
        if unknown:
            details.append(f"未知: {', '.join(unknown)}")
        fail("AI_FIGURE_OUTPUT_INVALID", "boundsが不正です（" + "、".join(details) + "）。")

    numbers: dict[str, float] = {}
    for key in ALLOWED_BOUND_KEYS:
        raw = value[key]
        if isinstance(raw, bool) or not isinstance(raw, (int, float)) or not math.isfinite(raw):
            fail("AI_FIGURE_OUTPUT_INVALID", f"bounds.{key}には有限数が必要です。")
        numbers[key] = float(raw)

    left = max(0.0, min(1.0, numbers["left"]))
    top = max(0.0, min(1.0, numbers["top"]))
    right = max(0.0, min(1.0, numbers["right"]))
    bottom = max(0.0, min(1.0, numbers["bottom"]))
    if not left < right or not top < bottom:
        fail("AI_FIGURE_OUTPUT_INVALID", "boundsはclamp後も正の幅と高さを持つ必要があります。")
    return left, top, right, bottom


def resolve_pdftoppm(request: dict[str, Any], base_dir: Path) -> str:
    configured = request.get("pdftoppmPath") or os.environ.get("PDFTOPPM_PATH")
    if configured:
        if not isinstance(configured, str):
            fail("AI_RUNTIME_TOOL_UNAVAILABLE", "pdftoppmPathは文字列で指定してください。")
        executable = resolve_path(configured, base_dir)
        if not executable.is_file():
            fail("AI_RUNTIME_TOOL_UNAVAILABLE", "指定されたpdftoppmを利用できません。")
        return str(executable)
    discovered = shutil.which("pdftoppm")
    if not discovered:
        fail(
            "AI_RUNTIME_TOOL_UNAVAILABLE",
            "pdftoppmを利用できません。PATH、PDFTOPPM_PATH、またはpdftoppmPathを設定してください。",
        )
    return discovered


def inspect_pdf(pdf_path: Path, page_number: int) -> tuple[int, int]:
    if not pdf_path.is_file():
        fail("AI_PDF_MISSING", "元PDFが見つかりません。")
    try:
        reader = PdfReader(str(pdf_path), strict=False)
        if reader.is_encrypted and reader.decrypt("") == 0:
            fail("AI_PDF_ENCRYPTED", "暗号化PDFを復号できません。")
        page_count = len(reader.pages)
        if page_number < 1 or page_number > page_count:
            fail("AI_RANGE_PAGE_NOT_FOUND", f"PDFページ{page_number}は存在しません（全{page_count}ページ）。")
        raw_rotation = reader.pages[page_number - 1].get("/Rotate", 0)
        native_rotation = int(raw_rotation or 0) % 360
        if native_rotation not in ALLOWED_ROTATIONS:
            native_rotation = 0
        return page_count, native_rotation
    except PdfReadError as error:
        fail("AI_PDF_UNREADABLE", "PDFを読み取れません。", technical_message=str(error))
    except OSError as error:
        fail("AI_PDF_UNREADABLE", "PDFファイルを開けません。", technical_message=str(error))


def render_page(pdftoppm: str, pdf_path: Path, page_number: int, dpi: int, output_prefix: Path) -> Path:
    command = [
        pdftoppm,
        "-f",
        str(page_number),
        "-l",
        str(page_number),
        "-r",
        str(dpi),
        "-cropbox",
        "-png",
        "-singlefile",
        str(pdf_path),
        str(output_prefix),
    ]
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=120, check=False)
    except (OSError, subprocess.SubprocessError) as error:
        fail("AI_RUNTIME_TOOL_UNAVAILABLE", "pdftoppmの実行に失敗しました。", technical_message=str(error))
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "pdftoppm failed").strip()
        fail("AI_PDF_UNREADABLE", "PDFページをレンダリングできません。", technical_message=detail[:1000])
    rendered = output_prefix.with_suffix(".png")
    if not rendered.is_file() or rendered.stat().st_size == 0:
        fail("AI_FIGURE_OUTPUT_INVALID", "PDFレンダリング結果が生成されませんでした。")
    return rendered


def save_crop(image: Image.Image, output_path: Path, mime_type: str) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image_format = MIME_TO_FORMAT[mime_type]
    options: dict[str, Any] = {}
    prepared = image
    if image_format == "JPEG":
        if image.mode not in ("RGB", "L"):
            background = Image.new("RGB", image.size, "white")
            if image.mode == "RGBA":
                background.paste(image, mask=image.getchannel("A"))
            else:
                background.paste(image.convert("RGB"))
            prepared = background
        options = {"quality": 92, "optimize": True}
    elif image_format == "PNG":
        options = {"optimize": True}
    elif image_format == "WEBP":
        options = {"quality": 90, "method": 6}
    try:
        prepared.save(output_path, format=image_format, **options)
    except (OSError, ValueError) as error:
        fail("AI_FIGURE_OUTPUT_INVALID", "Crop画像を保存できません。", technical_message=str(error))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="UTF-8 JSON request path")
    arguments = parser.parse_args()

    request_path = Path(arguments.input).expanduser().resolve()
    request = load_request(request_path)
    base_dir = request_path.parent

    pdf_path = resolve_path(require_string(request, "pdfPath"), base_dir)
    output_path = resolve_path(require_string(request, "outputPath"), base_dir)
    if pdf_path == output_path:
        fail("AI_FIGURE_OUTPUT_INVALID", "元PDFを出力先として上書きできません。")

    page_number = request.get("pdfPageNumber")
    if isinstance(page_number, bool) or not isinstance(page_number, int):
        fail("AI_RANGE_PAGE_NOT_FOUND", "pdfPageNumberには1始まりの整数が必要です。")

    rotation = request.get("rotationApplied", 0)
    if isinstance(rotation, bool) or not isinstance(rotation, int) or rotation not in ALLOWED_ROTATIONS:
        fail("AI_FIGURE_OUTPUT_INVALID", "rotationAppliedは0、90、180、270のいずれかです。")

    dpi = request.get("dpi", 200)
    if isinstance(dpi, bool) or not isinstance(dpi, int) or dpi < 72 or dpi > 600:
        fail("AI_FIGURE_OUTPUT_INVALID", "dpiは72～600の整数で指定してください。")

    mime_type = request.get("outputMimeType", "image/png")
    if mime_type not in MIME_TO_FORMAT:
        fail("AI_FIGURE_OUTPUT_INVALID", "outputMimeTypeはPNG、JPEG、WebPだけです。")

    bounds = validate_bounds(request.get("bounds"))
    _, native_rotation = inspect_pdf(pdf_path, page_number)
    pdftoppm = resolve_pdftoppm(request, base_dir)

    try:
        with tempfile.TemporaryDirectory(prefix="math-editor-crop-") as temp_dir:
            rendered_path = render_page(
                pdftoppm,
                pdf_path,
                page_number,
                dpi,
                Path(temp_dir) / "page",
            )
            with Image.open(rendered_path) as source:
                source.load()
                correction = (rotation - native_rotation) % 360
                corrected = source.rotate(-correction, expand=True) if correction else source.copy()
                width, height = corrected.size
                left, top, right, bottom = bounds
                pixel_bounds = (
                    max(0, math.floor(left * width)),
                    max(0, math.floor(top * height)),
                    min(width, math.ceil(right * width)),
                    min(height, math.ceil(bottom * height)),
                )
                if pixel_bounds[0] >= pixel_bounds[2] or pixel_bounds[1] >= pixel_bounds[3]:
                    fail("AI_FIGURE_OUTPUT_INVALID", "Crop範囲が1ピクセル未満です。")
                cropped = corrected.crop(pixel_bounds)
                crop_width, crop_height = cropped.size
                if (
                    crop_width > MAX_IMAGE_EDGE
                    or crop_height > MAX_IMAGE_EDGE
                    or crop_width * crop_height > MAX_IMAGE_PIXELS
                ):
                    fail("AI_FIGURE_OUTPUT_INVALID", "Crop画像が寸法上限を超えています。DPIを下げて再実行してください。")
                save_crop(cropped, output_path, mime_type)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as error:
        fail("AI_FIGURE_OUTPUT_INVALID", "レンダリング画像を処理できません。", technical_message=str(error))

    byte_length = output_path.stat().st_size
    if byte_length <= 0 or byte_length > MAX_IMAGE_BYTES:
        try:
            output_path.unlink(missing_ok=True)
        except OSError:
            pass
        fail("AI_FIGURE_OUTPUT_INVALID", "Crop画像が空、または10MiB上限を超えています。DPIを下げて再実行してください。")

    digest = hashlib.sha256(output_path.read_bytes()).hexdigest()
    with Image.open(output_path) as verified:
        verified.load()
        width, height = verified.size

    emit(
        {
            "ok": True,
            "outputPath": str(output_path),
            "mimeType": mime_type,
            "width": width,
            "height": height,
            "byteLength": byte_length,
            "sha256": digest,
        },
        0,
    )


if __name__ == "__main__":
    main()
