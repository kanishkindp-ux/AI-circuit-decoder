"""CircuitLens API — FastAPI backend.

Endpoints:
  GET  /health              — Service health check
  POST /api/upload-url      — Generate S3 pre-signed upload URL
  POST /api/analyze         — Full circuit analysis (single-shot)
  POST /api/analyze/stream  — Streaming circuit analysis (SSE)
  POST /api/detect          — Component detection (Roboflow)
  POST /api/ocr             — Text detection (Rekognition)
"""

import json
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import settings
from aws_services import s3_service, rekognition_service
from gemini_client import gemini_service
from roboflow_client import roboflow_service

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("circuitlens")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="CircuitLens API",
    description="AI-powered breadboard circuit debugger",
    version="0.1.0",
)

# CORS — allow the Vite dev server and common local origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite default
        "http://localhost:3000",   # Common alt
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================================
# Request / Response Models
# =========================================================================

class UploadURLRequest(BaseModel):
    """Request a pre-signed S3 upload URL."""
    filename: str
    content_type: str = "image/jpeg"


class UploadURLResponse(BaseModel):
    upload_url: str
    s3_key: str
    bucket: str


class AnalyzeRequest(BaseModel):
    """Request circuit analysis on an uploaded image."""
    s3_key: str
    edge_map_base64: str | None = None
    roboflow_detections: dict | None = None
    lab_context: str | None = None


class DetectRequest(BaseModel):
    """Request Roboflow component detection."""
    s3_key: str


class OCRRequest(BaseModel):
    """Request Rekognition OCR."""
    s3_key: str


# =========================================================================
# Health Check
# =========================================================================

@app.get("/health")
async def health():
    """Basic liveness check."""
    return {"status": "ok", "version": "0.1.0", "service": "CircuitLens API"}


@app.get("/")
async def root():
    """Landing page — confirms the API is running and links to docs."""
    return {
        "service": "CircuitLens API",
        "version": "0.1.0",
        "status": "running",
        "docs": "http://localhost:8000/docs",
        "health": "http://localhost:8000/health/detailed",
        "endpoints": [
            "POST /api/upload-url",
            "POST /api/analyze",
            "POST /api/analyze/stream",
            "POST /api/detect",
            "POST /api/ocr",
        ],
    }


@app.get("/health/detailed")
async def health_detailed():
    """Deep health check — tests connectivity to all external services."""
    results = {
        "S3": s3_service.check_connection(),
        "Rekognition": rekognition_service.check_connection(),
        "Gemini": gemini_service.check_connection(),
        "Roboflow": roboflow_service.check_connection(),
    }
    all_ok = all(
        r["status"] in ("PASS", "SKIP") for r in results.values()
    )
    return {
        "overall": "PASS" if all_ok else "FAIL",
        "services": results,
    }


# =========================================================================
# Upload URL
# =========================================================================

@app.post("/api/upload-url", response_model=UploadURLResponse)
async def get_upload_url(req: UploadURLRequest):
    """Generate a pre-signed PUT URL for direct browser → S3 upload.

    The frontend uses this URL to upload the image directly to S3
    without sending the file through the backend (zero memory overhead).
    """
    try:
        url, key = s3_service.generate_presigned_upload_url(
            req.filename, req.content_type
        )
        logger.info(f"Generated upload URL for key: {key}")
        return UploadURLResponse(
            upload_url=url, s3_key=key, bucket=settings.S3_BUCKET_NAME
        )
    except Exception as exc:
        logger.error(f"Failed to generate upload URL: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# =========================================================================
# Circuit Analysis (Single-Shot)
# =========================================================================

@app.post("/api/analyze")
async def analyze_circuit(req: AnalyzeRequest):
    """Full pipeline: S3 image → Roboflow → Rekognition OCR → Gemini analysis.

    Steps:
      1. Download the image from S3
      2. Run Roboflow detection (or use client-provided detections)
      3. Run Rekognition OCR
      4. Send everything to Gemini for multimodal analysis
      5. Return the structured diagnostic JSON
    """
    try:
        # 1. Get image from S3
        logger.info(f"Analyzing circuit: {req.s3_key}")
        image_bytes = s3_service.download_image(req.s3_key)

        # 2. Component detection (Roboflow)
        detections = req.roboflow_detections
        if detections is None:
            detections = roboflow_service.detect(image_bytes)

        # 3. OCR (Rekognition)
        try:
            ocr_results = rekognition_service.detect_text(req.s3_key)
        except Exception as ocr_exc:
            logger.warning(f"OCR failed (non-fatal): {ocr_exc}")
            ocr_results = []

        # 4. Gemini analysis
        analysis_text = gemini_service.analyze_circuit(
            image_bytes=image_bytes,
            ocr_results=ocr_results,
            detections=detections,
            edge_map_base64=req.edge_map_base64,
            lab_context=req.lab_context,
        )

        # 5. Try to parse the AI response as JSON
        try:
            analysis_json = json.loads(analysis_text)
        except json.JSONDecodeError:
            # If Gemini didn't return clean JSON, wrap it
            analysis_json = {"raw_response": analysis_text}

        return {
            "analysis": analysis_json,
            "ocr": ocr_results,
            "detections": detections,
        }

    except Exception as exc:
        logger.error(f"Analysis failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# =========================================================================
# Circuit Analysis (Streaming via SSE)
# =========================================================================

@app.post("/api/analyze/stream")
async def analyze_circuit_stream(req: AnalyzeRequest):
    """Streaming version — returns tokens via Server-Sent Events.

    The frontend receives each token as it's generated, giving a
    responsive "typing" experience instead of a loading spinner.
    """
    try:
        image_bytes = s3_service.download_image(req.s3_key)

        detections = req.roboflow_detections
        if detections is None:
            detections = roboflow_service.detect(image_bytes)

        try:
            ocr_results = rekognition_service.detect_text(req.s3_key)
        except Exception:
            ocr_results = []

        async def event_generator():
            try:
                async for token in gemini_service.analyze_circuit_stream(
                    image_bytes=image_bytes,
                    ocr_results=ocr_results,
                    detections=detections,
                    edge_map_base64=req.edge_map_base64,
                    lab_context=req.lab_context,
                ):
                    yield f"data: {json.dumps({'token': token})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"
            except Exception as stream_exc:
                yield f"data: {json.dumps({'error': str(stream_exc)})}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    except Exception as exc:
        logger.error(f"Streaming analysis failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# =========================================================================
# Component Detection (Roboflow)
# =========================================================================

@app.post("/api/detect")
async def detect_components(req: DetectRequest):
    """Run Roboflow object detection on an uploaded image."""
    try:
        image_bytes = s3_service.download_image(req.s3_key)
        detections = roboflow_service.detect(image_bytes)
        return {"detections": detections}
    except Exception as exc:
        logger.error(f"Detection failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# =========================================================================
# OCR (Rekognition)
# =========================================================================

@app.post("/api/ocr")
async def ocr_image(req: OCRRequest):
    """Run Rekognition text detection on an uploaded image."""
    try:
        results = rekognition_service.detect_text(req.s3_key)
        return {"ocr_results": results}
    except Exception as exc:
        logger.error(f"OCR failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
