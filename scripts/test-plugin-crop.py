"""自作PDFで配布Cropperの回転・CropBox・代替描画・Asset検証を行う。"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

from PIL import Image
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject, RectangleObject


def run_json(command: list[str], expected_status: int = 0) -> dict:
    """CLIの終了状態と構造化出力を一緒に検証する。"""
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", timeout=60, check=False)
    assert result.returncode == expected_status, (command[0], result.returncode, result.stdout, result.stderr)
    return json.loads(result.stdout)


def create_source(output: Path, rotation: int) -> None:
    """既知の位置に赤い正方形を持つ、権利上問題のない検査用PDFを生成する。"""
    writer = PdfWriter()
    page = writer.add_blank_page(width=200, height=120)
    stream = DecodedStreamObject()
    stream.set_data(b"q 1 0 0 rg 40 30 40 40 re f Q\n")
    page[NameObject("/Contents")] = writer._add_object(stream)
    page.cropbox = RectangleObject([20, 10, 180, 110])
    page.rotate(rotation)
    with output.open("wb") as handle:
        writer.write(handle)


def main() -> None:
    """指定した実Backendすべてで合成PDFを切り出し完成JSONまで検証する。"""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plugin", default="dist/sugaku-jitate-ai")
    parser.add_argument("--backends", default="poppler,pypdfium2")
    parser.add_argument("--node", default="node")
    args = parser.parse_args()
    skill = Path(args.plugin).resolve() / "skills" / "sugaku-jitate-textbook-import"
    fixture = Path(__file__).parent / "fixtures" / "ai-plugin" / "confirmed-draft.json"
    tested = []
    with tempfile.TemporaryDirectory(prefix="sugaku-jitate-crop-test-") as temporary:
        root = Path(temporary)
        for backend in args.backends.split(","):
            for native_rotation, rotation in [(0, 0), (90, 0), (90, 90)]:
                source = root / "original.pdf"
                create_source(source, native_rotation)
                source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
                bounds = {"left": .125, "top": .4, "right": .375, "bottom": .8} if rotation == 0 else {"left": .2, "top": .125, "right": .6, "bottom": .375}
                request = {
                    "pdfPath": str(source), "pdfPageNumber": 1, "bounds": bounds,
                    "rotationApplied": rotation, "dpi": 144, "outputMimeType": "image/png",
                    "outputPath": str(root / "figure.png"), "backend": backend,
                }
                request_path = root / "crop.json"
                request_path.write_text(json.dumps(request), encoding="utf-8")
                crop = run_json([sys.executable, str(skill / "scripts/crop_pdf_figure.py"), "--input", str(request_path)])
                assert crop["ok"] is True and crop["backend"] == backend
                assert crop["width"] == crop["height"] == 80, crop
                with Image.open(crop["outputPath"]) as image:
                    red, green, blue = image.convert("RGB").getpixel((40, 40))
                    assert red > 245 and green < 10 and blue < 10, (backend, native_rotation, rotation)
                assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
                draft = json.loads(fixture.read_text(encoding="utf-8"))
                draft["items"][0]["figures"] = [{
                    "figureKey": "square", "sourcePdfPageNumber": 1, "purpose": "problem", "bounds": bounds,
                    "rotationApplied": rotation, "cropRevision": 1, "accepted": True, "issueIds": [],
                    "placement": "block", "widthPercent": 50, "alt": "検査用の赤い正方形",
                    "output": {"storageKey": "figure.png", "fileName": "figure.png", **{key: crop[key] for key in ["mimeType", "width", "height", "byteLength", "sha256"]}},
                }]
                draft_path = root / "draft.json"
                draft_path.write_text(json.dumps(draft), encoding="utf-8")
                candidate = root / f"candidate-{backend}-{native_rotation}-{rotation}.json"
                run_json([args.node, str(skill / "scripts/build_math_worksheet_file.mjs"), "--draft", str(draft_path), "--output", str(candidate), "--asset-root", str(root)])
                validated = run_json([args.node, str(skill / "scripts/validate_math_worksheet.mjs"), str(candidate)])
                assert validated["valid"] is True and validated["errors"] == []
                assert validated["summary"]["assetCount"] == 1
                tested.append({"backend": backend, "nativeRotation": native_rotation, "rotationApplied": rotation, "valid": True})
        # 明示したPoppler実行パスが利用不能でも、自動経路なら代替できる。
        request["backend"] = "auto"
        request["pdftoppmPath"] = str(root / "unavailable-pdftoppm")
        request_path.write_text(json.dumps(request), encoding="utf-8")
        fallback = run_json([sys.executable, str(skill / "scripts/crop_pdf_figure.py"), "--input", str(request_path)])
        assert fallback["backend"] in {"pymupdf", "pypdfium2", "mutool"}
        assert fallback["warnings"] == ["FIGURE_PRIMARY_RUNTIME_UNAVAILABLE"]
        request["pdfPageNumber"] = 999
        request_path.write_text(json.dumps(request), encoding="utf-8")
        invalid = run_json([sys.executable, str(skill / "scripts/crop_pdf_figure.py"), "--input", str(request_path)], 1)
        assert invalid["code"] == "AI_RANGE_PAGE_NOT_FOUND"
    print(json.dumps({"ok": True, "cases": tested, "automaticFallback": fallback["backend"], "invalidPageRejected": True}))


if __name__ == "__main__":
    main()
