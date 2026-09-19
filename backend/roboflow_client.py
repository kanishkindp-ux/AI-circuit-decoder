"""Roboflow Workflows client for CircuitLens.

Integrates the trained RF-DETR model via the Roboflow Workflows REST API.

Workflow endpoint:
  POST https://serverless.roboflow.com/<workspace>/<workflow_id>

The detect() method sends a base64-encoded image to the workflow,
parses the response, and returns a standardised list of detections
that the main FastAPI orchestrator and Gemini client consume.

Standardised detection format:
  [
    {
      "id": "comp-1",
      "name": "Class Name Title Cased",
      "type": "raw_class_name",
      "confidence": 0.98,
      "rect": {"x": 100, "y": 200, "w": 50, "h": 20}
    }
  ]
"""

import base64
import json
import logging
import os
import urllib.request

logger = logging.getLogger("circuitlens.roboflow")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
def _load_api_key() -> str:
    """Load key from env var first, fall back to pydantic settings (.env file)."""
    key = os.getenv("ROBOFLOW_API_KEY", "")
    if not key:
        try:
            from config import settings
            key = settings.ROBOFLOW_API_KEY or ""
        except Exception:
            pass
    return key

ROBOFLOW_API_KEY = _load_api_key()

WORKFLOW_URL = (
    "https://serverless.roboflow.com"
    "/kanishk-sharma-4yrkt/workflows/circuitlens-hgrfp"
)

DEFAULT_CONFIDENCE = 0.4
DEFAULT_IOU_THRESHOLD = 0.3
REQUEST_TIMEOUT = 30  # seconds


class RoboflowService:
    """Detects breadboard components using a trained RF-DETR model
    via the Roboflow Workflows REST API."""

    def __init__(self):
        self.api_key = ROBOFLOW_API_KEY
        self.url = WORKFLOW_URL
        self.is_configured = bool(self.api_key)

    # ------------------------------------------------------------------
    # Core detection
    # ------------------------------------------------------------------
    def detect(self, image_bytes: bytes | None = None) -> list[dict]:
        """Run object detection on raw image bytes.

        Converts image_bytes to base64, sends them to the Roboflow
        Workflows endpoint, and returns a standardised detection list.

        Args:
            image_bytes: Raw image bytes (JPEG/PNG).

        Returns:
            List of standardised detection dicts, or [] on failure.
        """
        if not self.is_configured:
            logger.warning(
                "Roboflow API key not set — skipping detection. "
                "Set ROBOFLOW_API_KEY in .env to enable."
            )
            return []

        if image_bytes is None:
            logger.warning("No image bytes provided — skipping detection.")
            return []

        # Encode raw bytes to a clean base64 string (no data-URL prefix)
        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        return self.query_roboflow_image(b64_image)

    # ------------------------------------------------------------------
    # Workflows REST call
    # ------------------------------------------------------------------
    def query_roboflow_image(self, image_base64: str) -> list[dict]:
        """Send a base64 image to the Roboflow Workflows endpoint.

        Args:
            image_base64: Base64-encoded image string.
                          Any ``data:image/...;base64,`` prefix is
                          stripped automatically.

        Returns:
            Standardised list of detection dicts, or [] on failure.
        """
        # Strip data-URL prefix if present
        if "," in image_base64 and image_base64.index(",") < 100:
            image_base64 = image_base64.split(",", 1)[1]

        payload = json.dumps({
            "inputs": {
                "image": {"type": "base64", "value": image_base64},
                "confidence": DEFAULT_CONFIDENCE,
                "iou_threshold": DEFAULT_IOU_THRESHOLD,
            }
        }).encode("utf-8")

        req = urllib.request.Request(
            self.url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
                raw = json.loads(resp.read())

            return self._parse_workflow_response(raw)

        except Exception as exc:
            logger.error(f"Roboflow Workflows request failed: {type(exc).__name__}: {exc}")
            return []

    # ------------------------------------------------------------------
    # Response parsing
    # ------------------------------------------------------------------
    @staticmethod
    def _parse_workflow_response(raw: dict | list) -> list[dict]:
        """Extract predictions from the Workflows response and
        normalise them into the standard detection format.

        The Workflows API may return different shapes depending on
        configuration. This parser handles the common patterns:
          - {"outputs": [{"predictions": {...}}]}
          - {"predictions": [...]}
          - [{"predictions": {...}}]
        """
        predictions = []

        try:
            # Pattern 1: {"outputs": [{"predictions": {...}}]}
            if isinstance(raw, dict) and "outputs" in raw:
                for output_block in raw["outputs"]:
                    preds = output_block.get("predictions", {})
                    if isinstance(preds, dict) and "predictions" in preds:
                        predictions = preds["predictions"]
                    elif isinstance(preds, list):
                        predictions = preds

            # Pattern 2: top-level list  [{"predictions": {...}}]
            elif isinstance(raw, list) and len(raw) > 0:
                first = raw[0]
                if isinstance(first, dict):
                    preds = first.get("predictions", {})
                    if isinstance(preds, dict) and "predictions" in preds:
                        predictions = preds["predictions"]
                    elif isinstance(preds, list):
                        predictions = preds

            # Pattern 3: {"predictions": [...]}
            elif isinstance(raw, dict) and "predictions" in raw:
                p = raw["predictions"]
                if isinstance(p, dict) and "predictions" in p:
                    predictions = p["predictions"]
                elif isinstance(p, list):
                    predictions = p

        except Exception as exc:
            logger.error(f"Failed to parse Roboflow response: {exc}")
            return []

        # Normalise each prediction into the standard format
        results = []
        for idx, pred in enumerate(predictions):
            try:
                raw_class = pred.get("class", pred.get("class_name", "unknown"))

                # Bounding box — Roboflow returns center (x, y) + width/height
                x = pred.get("x", 0)
                y = pred.get("y", 0)
                w = pred.get("width", pred.get("w", 0))
                h = pred.get("height", pred.get("h", 0))

                results.append({
                    "id": f"comp-{idx + 1}",
                    "name": raw_class.replace("_", " ").replace("-", " ").title(),
                    "type": raw_class,
                    "confidence": round(pred.get("confidence", 0.0), 4),
                    "rect": {
                        "x": round(x),
                        "y": round(y),
                        "w": round(w),
                        "h": round(h),
                    },
                })
            except Exception as pred_exc:
                logger.warning(f"Skipping malformed prediction #{idx}: {pred_exc}")

        logger.info(f"Roboflow detected {len(results)} component(s)")
        return results

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------
    def check_connection(self) -> dict:
        """Quick connectivity check against the Roboflow API."""
        if not self.is_configured:
            return {
                "status": "SKIP",
                "detail": "Not configured — set ROBOFLOW_API_KEY in .env",
            }
        try:
            url = f"https://api.roboflow.com/?api_key={self.api_key}"
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                workspace = data.get("workspace", "unknown")
                return {
                    "status": "PASS",
                    "detail": f"Authenticated to workspace '{workspace}'",
                }
        except Exception as exc:
            return {"status": "FAIL", "detail": f"{type(exc).__name__}: {exc}"}


# -------------------------------------------------------------------------
# Module-level singleton
# -------------------------------------------------------------------------
roboflow_service = RoboflowService()
