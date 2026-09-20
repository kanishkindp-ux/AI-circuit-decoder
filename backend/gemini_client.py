"""Gemini multimodal client for CircuitLens.

Uses the new `google-genai` SDK (successor to `google-generativeai`).

Handles circuit analysis by sending breadboard images + contextual data
(OCR, edge maps, Roboflow detections) to Gemini 2.5 Flash for
structured diagnostic output.

Supports both single-shot and SSE streaming responses.
"""

import base64
import io
import json
from typing import AsyncGenerator

from google import genai
from google.genai import types
from PIL import Image

from config import settings

# ---------------------------------------------------------------------------
# Configure the Gemini client
# ---------------------------------------------------------------------------
client = genai.Client(api_key=settings.GEMINI_API_KEY)

MODEL_ID = "gemini-2.5-flash"

# ---------------------------------------------------------------------------
# System prompt — the core intelligence of CircuitLens
# ---------------------------------------------------------------------------
CIRCUIT_ANALYSIS_PROMPT = """\
You are **CircuitLens**, an expert electronics engineer and circuit debugger.
You are analyzing a top-down photograph of a physical breadboard circuit.

## Available Data
- **Image**: The breadboard photograph (attached)
{edge_map_section}
{ocr_section}
{detection_section}
{lab_context_section}

## Your Task
1. **Identify components (STRICT CONSTRAINT)**: You MUST ONLY identify and list the components that are explicitly provided in the **Object Detection** JSON data. DO NOT hallucinate, guess, or invent components (e.g., transistors, 555 timers, or capacitors) that are not in the detection list. The detection list is the absolute GROUND TRUTH. Only jumper wires/power rails can be inferred visually if they aren't in the detection list.
2. **Trace the wiring** — determine which breadboard rows/columns are electrically connected via jumper wires and the detected components.
3. **Identify the circuit type** — describe what this specific combination of DETECTED components is likely trying to achieve (e.g., simple LED circuit, buzzer circuit).
4. **Find wiring errors (BE HIGHLY CRITICAL AND AGGRESSIVE)**:
   - Floating components: If a component leg (e.g., a resistor or LED) is inserted into a row, but NO other wire or component connects to that SAME row, the circuit is OPEN and will not work! This is a CRITICAL ERROR.
   - Missing connections to Power/Ground rails.
   - Missing Current-Limiting Resistors: If an LED (especially the top LED) is connected directly to a power rail without a resistor in series, it will burn out! This is a CRITICAL ERROR.
   - Wrong pin assignments (e.g., connecting to the wrong side of the trench).
   - Backward/reversed components (polarity errors for LEDs or capacitors).
   - Short circuits (two rails bridged that shouldn't be).
   - NEVER assume a circuit is correct if you see a floating pin or incomplete loop.
5. **Flag safety hazards** — reversed electrolytic capacitors, power rail shorts, over-voltage conditions.
6. **Wokwi Parts Layout**: Generate a `parts` array compatible with Wokwi Elements JSON to visually recreate the layout. Map the detected components to Wokwi types (e.g., `wokwi-breadboard-half`, `board-esp32-devkit-c-v4`, `wokwi-led`, `wokwi-resistor`, `wokwi-buzzer`). Estimate their `top`, `left`, and `rotate` (in degrees) coordinates so they are arranged visually (e.g. breadboard at top:0, left:0). Assign appropriate `attrs` like `{{"color": "red"}}` for LEDs or `{{"value": "220"}}` for resistors.

## Response Format
Respond ONLY with a valid JSON object (no markdown fencing, no extra text):
{{
  "circuit_type": "Human-readable description of the circuit",
  "components": [
    {{
      "id": "U1",
      "type": "NE555P",
      "location": "rows 20-26, columns E-F",
      "orientation": "correct | reversed | unknown"
    }}
  ],
  "parts": [
    {{
      "type": "wokwi-breadboard-half",
      "id": "bb1",
      "top": 16.2,
      "left": -54.8,
      "rotate": 0,
      "attrs": {{}}
    }},
    {{
      "type": "wokwi-led",
      "id": "led1",
      "top": 164.8,
      "left": 157.8,
      "rotate": 180,
      "attrs": {{ "color": "red" }}
    }}
  ],
  "connections": [
    {{
      "from": "U1 pin 3 (output)",
      "to": "Row 15 col A (LED anode)",
      "status": "correct | missing | wrong",
      "note": "optional explanation"
    }}
  ],
  "errors": [
    {{
      "severity": "critical | warning | info",
      "description": "Detailed description of the error",
      "fix": "Step-by-step fix instruction"
    }}
  ],
  "safety_hazards": [
    {{
      "component": "C1",
      "issue": "Electrolytic capacitor appears reversed",
      "action": "Check polarity markings and swap leads"
    }}
  ],
  "confidence": 0.85,
  "summary": "Brief 2-3 sentence summary for the student"
}}
"""


class GeminiService:
    """Multimodal circuit analysis using Gemini."""

    def __init__(self):
        self.client = client

    # ------------------------------------------------------------------
    # Prompt builder
    # ------------------------------------------------------------------
    @staticmethod
    def _build_prompt(
        ocr_results: list[dict] | None = None,
        detections: dict | None = None,
        edge_map_base64: str | None = None,
        lab_context: str | None = None,
    ) -> str:
        edge_section = ""
        if edge_map_base64:
            edge_section = (
                "- **Edge Map**: A Canny edge-detected version is also attached, "
                "showing wire paths more clearly."
            )

        ocr_section = ""
        if ocr_results:
            ocr_text = json.dumps(ocr_results, indent=2)
            ocr_section = (
                f"- **OCR Results** (text detected on components):\n"
                f"```json\n{ocr_text}\n```"
            )

        detection_section = ""
        if detections:
            det_text = json.dumps(detections, indent=2)
            detection_section = (
                f"- **Object Detection** (component bounding boxes):\n"
                f"```json\n{det_text}\n```"
            )

        lab_section = ""
        if lab_context:
            lab_section = f"- **Lab Manual Context**: {lab_context}"

        return CIRCUIT_ANALYSIS_PROMPT.format(
            edge_map_section=edge_section,
            ocr_section=ocr_section,
            detection_section=detection_section,
            lab_context_section=lab_section,
        )

    # ------------------------------------------------------------------
    # Build multimodal content list
    # ------------------------------------------------------------------
    @staticmethod
    def _build_contents(
        prompt: str,
        image_bytes: bytes,
        edge_map_base64: str | None = None,
    ) -> list:
        """Assemble the prompt + image(s) as content parts for Gemini."""
        # Create image part from bytes
        image = Image.open(io.BytesIO(image_bytes))
        # Convert to JPEG bytes for the API
        buf = io.BytesIO()
        image.save(buf, format="JPEG")
        jpeg_bytes = buf.getvalue()

        contents = [
            types.Part.from_text(text=prompt),
            types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg"),
        ]

        if edge_map_base64:
            edge_bytes = base64.b64decode(edge_map_base64)
            contents.append(
                types.Part.from_bytes(data=edge_bytes, mime_type="image/png")
            )

        return contents

    # ------------------------------------------------------------------
    # Single-shot analysis
    # ------------------------------------------------------------------
    def analyze_circuit(
        self,
        image_bytes: bytes,
        ocr_results: list[dict] | None = None,
        detections: dict | None = None,
        edge_map_base64: str | None = None,
        lab_context: str | None = None,
    ) -> str:
        """Run a full circuit analysis and return the complete response."""
        prompt = self._build_prompt(ocr_results, detections, edge_map_base64, lab_context)
        contents = self._build_contents(prompt, image_bytes, edge_map_base64)
        response = self.client.models.generate_content(
            model=MODEL_ID,
            contents=contents,
        )
        return response.text

    # ------------------------------------------------------------------
    # Streaming analysis (for SSE)
    # ------------------------------------------------------------------
    async def analyze_circuit_stream(
        self,
        image_bytes: bytes,
        ocr_results: list[dict] | None = None,
        detections: dict | None = None,
        edge_map_base64: str | None = None,
        lab_context: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream circuit analysis token-by-token for SSE."""
        prompt = self._build_prompt(ocr_results, detections, edge_map_base64, lab_context)
        contents = self._build_contents(prompt, image_bytes, edge_map_base64)

        # Use sync streaming in an async wrapper (the SDK handles it)
        response = self.client.models.generate_content_stream(
            model=MODEL_ID,
            contents=contents,
        )
        for chunk in response:
            if chunk.text:
                yield chunk.text

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------
    def check_connection(self) -> dict:
        """Quick connectivity check — send a trivial prompt."""
        try:
            response = self.client.models.generate_content(
                model=MODEL_ID,
                contents="Respond with only: OK",
            )
            return {"status": "PASS", "detail": f"Gemini reachable (response: {response.text.strip()[:20]})"}
        except Exception as exc:
            return {"status": "FAIL", "detail": f"{type(exc).__name__}: {exc}"}


# -------------------------------------------------------------------------
# Module-level singleton
# -------------------------------------------------------------------------
gemini_service = GeminiService()
