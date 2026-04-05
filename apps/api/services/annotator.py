"""
annotator.py — uses Gemini Vision to identify the broken UI element in a screenshot,
then draws a colored bounding box + label on the image using Pillow.

Only runs for non-pass results and only when GOOGLE_API_KEY is set.
Silently skips if Gemini can't identify a specific element or if any error occurs.
"""
import json
import os
from pathlib import Path

from models.schemas import TestCase, TestResultPayload

# Color per status (RGB)
_COLORS: dict[str, tuple[int, int, int]] = {
    "fail":    (220, 38, 38),   # red-600
    "blocked": (245, 158, 11),  # amber-500
    "flaky":   (14, 165, 233),  # sky-500
}

_LOCATE_PROMPT = """\
You are analyzing a browser screenshot to find the exact UI element that is broken or problematic.

Test: {name}
Failed step: {failed_step}
Expected: {expected}
Actual: {actual}
Suspected issue: {suspected_issue}

Carefully examine the screenshot and identify the specific element (button, input, heading, link,
error message, etc.) that corresponds to this failure.

Return ONLY valid JSON with these keys:
  "found": true or false
  "x": left edge as integer percentage of image width (0–100)
  "y": top edge as integer percentage of image height (0–100)
  "w": width  as integer percentage of image width  (0–100)
  "h": height as integer percentage of image height (0–100)
  "label": very short description, max 30 chars (e.g. "Submit button", "Error message")

If you cannot identify a specific element, return {{"found": false}}.
Do not return any text outside the JSON object.
"""


async def annotate_screenshot(
    shot_path: Path,
    case: TestCase,
    validated: TestResultPayload,
) -> None:
    """Mutate shot_path in-place: draw a colored box around the broken element.

    Silently returns on any error so it never breaks the pipeline.
    """
    if validated.status == "pass":
        return
    if not shot_path.exists():
        return

    key = (os.getenv("GOOGLE_API_KEY") or "").strip()
    if not key:
        return

    try:
        _draw_box(shot_path, case, validated, key)
    except Exception:
        pass  # never break the pipeline


def _draw_box(
    shot_path: Path,
    case: TestCase,
    validated: TestResultPayload,
    key: str,
) -> None:
    from google import genai
    from google.genai import types
    from PIL import Image, ImageDraw

    img_bytes = shot_path.read_bytes()
    prompt = _LOCATE_PROMPT.format(
        name=case.name,
        failed_step=validated.failed_step or "",
        expected=validated.expected[:200],
        actual=validated.actual[:200],
        suspected_issue=validated.suspected_issue[:200],
    )

    client = genai.Client(api_key=key)
    response = client.models.generate_content(
        model=os.getenv("GEMINI_ANNOTATOR_MODEL", "gemini-3-flash-preview"),
        contents=[
            types.Part.from_bytes(data=img_bytes, mime_type="image/png"),
            prompt,
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.1,
        ),
    )

    raw = json.loads(response.text or "{}")
    if not raw.get("found"):
        return

    x_pct = float(raw.get("x", 0))
    y_pct = float(raw.get("y", 0))
    w_pct = float(raw.get("w", 0))
    h_pct = float(raw.get("h", 0))
    label = str(raw.get("label", "Issue"))[:40]

    if w_pct <= 0 or h_pct <= 0:
        return

    img = Image.open(shot_path).convert("RGBA")
    iw, ih = img.size

    x1 = int(x_pct / 100 * iw)
    y1 = int(y_pct / 100 * ih)
    x2 = int((x_pct + w_pct) / 100 * iw)
    y2 = int((y_pct + h_pct) / 100 * ih)

    # Clamp to image bounds
    x1 = max(0, min(x1, iw - 1))
    y1 = max(0, min(y1, ih - 1))
    x2 = max(x1 + 1, min(x2, iw))
    y2 = max(y1 + 1, min(y2, ih))

    color = _COLORS.get(validated.status, (220, 38, 38))

    # Semi-transparent overlay inside the box
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    ov_draw.rectangle([x1, y1, x2, y2], fill=(*color, 40))
    img = Image.alpha_composite(img, overlay)

    # Thick border rectangle
    draw = ImageDraw.Draw(img)
    for thickness in range(4):
        draw.rectangle(
            [x1 - thickness, y1 - thickness, x2 + thickness, y2 + thickness],
            outline=(*color, 255),
        )

    # Label pill above the box
    char_w, char_h = 7, 13
    lw = len(label) * char_w + 12
    lh = char_h + 6
    lx = max(0, x1)
    ly = max(0, y1 - lh - 2)
    draw.rectangle([lx, ly, lx + lw, ly + lh], fill=(*color, 220))
    draw.text((lx + 6, ly + 3), label, fill=(255, 255, 255, 255))

    # Save as RGB PNG
    img.convert("RGB").save(shot_path, format="PNG")
