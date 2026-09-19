# CircuitLens — Decision Log

Every architectural and implementation decision is documented here in
chronological order. Each entry explains **what** was decided, **why**,
and **what was built** as a result.

---

## Decision 001 — Tech Stack: FastAPI over Express
**Date:** 2026-09-18  
**Status:** Accepted

### Context
The original project spec mentioned Express/Node.js, but the repo was
scaffolded with a Python/FastAPI backend.

### Decision
**Stick with FastAPI (Python).**

### Why
- **boto3** (AWS SDK) is native Python — no bridging needed for S3, Rekognition
- **google-generativeai** SDK is Python-first for Gemini integration
- Roboflow's SDK and inference API has best Python support
- FastAPI's async generators + `StreamingResponse` provide clean SSE streaming
- OpenCV has battle-tested Python bindings for any server-side fallback

### What Was Built
- `backend/main.py` — FastAPI application skeleton

---

## Decision 002 — Gemini Instead of Bedrock (Primary LLM)
**Date:** 2026-09-18  
**Status:** Accepted (Bedrock remains stretch goal)

### Context
Amazon Bedrock's Anthropic model access was blocked — the approval for
Claude was stuck with no ETA. The hackathon clock was ticking.

### Decision
**Use Google Gemini 2.5 Flash as the primary LLM.** Keep the architecture
pluggable so Bedrock can be swapped in later if approval arrives.

### Why
- Gemini API key is instant (no approval process)
- Free tier: 15 RPM, 1M tokens/day — plenty for a hackathon
- Gemini 2.5 Flash is multimodal (accepts images natively)
- Comparable quality to Claude for visual analysis tasks
- The code architecture uses a `GeminiService` class with the same
  interface a future `BedrockService` would implement

### What Was Built
- `backend/gemini_client.py` — Multimodal analysis with streaming support
- `.env` field `GEMINI_API_KEY` replaces `BEDROCK_*` as primary

---

## Decision 003 — S3 Pre-Signed URLs for Image Upload
**Date:** 2026-09-18  
**Status:** Accepted

### Context
Breadboard images can be 5-15MB. Routing them through the FastAPI backend
would create memory pressure and latency.

### Decision
**Frontend uploads directly to S3 using pre-signed PUT URLs.**

### Why
- Zero memory overhead on the backend — the file never touches our server
- The backend only generates a short-lived (5 min) signed URL
- S3 handles the heavy lifting of receiving and storing the file
- The backend later reads the image from S3 by key when analysis is requested
- CORS on the S3 bucket allows browser-origin PUT requests

### What Was Built
- `POST /api/upload-url` endpoint in `main.py`
- `S3Service.generate_presigned_upload_url()` in `aws_services.py`
- S3 bucket CORS configuration (documented in setup guide)

---

## Decision 004 — Roboflow Mock Fallback Pattern
**Date:** 2026-09-18  
**Status:** Accepted

### Context
The user's Roboflow model is still being trained. We can't block the
entire backend build on it.

### Decision
**Roboflow client returns realistic mock detections when not configured.
Automatically switches to the real API when credentials are set.**

### Why
- The full pipeline (upload → detect → OCR → analyze) can be tested end-to-end
  right now with mock data
- No code changes needed when the real model is ready — just set 3 env vars
- The mock data shape matches Roboflow's real API response format
- Downstream consumers (Gemini prompt, frontend SVG overlay) can be built
  against the mock shape now

### What Was Built
- `backend/roboflow_client.py` with `MOCK_DETECTIONS` and auto-switching
- `.env` fields `ROBOFLOW_PROJECT_ID` and `ROBOFLOW_MODEL_VERSION` (empty for now)

---

## Decision 005 — Pydantic Settings for Configuration
**Date:** 2026-09-18  
**Status:** Accepted

### Context
The app needs credentials from multiple sources (AWS, Gemini, Roboflow).
Loading them manually with `os.environ.get()` everywhere is error-prone.

### Decision
**Use `pydantic-settings` for typed, validated configuration from `.env`.**

### Why
- Type validation catches missing/malformed credentials at startup, not runtime
- Single `settings` import everywhere — no scattered `os.environ` calls
- Default values for optional fields (Roboflow, Bedrock)
- `.env` file path is resolved relative to `backend/` directory,
  so the app works regardless of where `uvicorn` is launched from

### What Was Built
- `backend/config.py` — `Settings` class with `@lru_cache` singleton

---

## Decision 006 — Structured JSON Output from Gemini
**Date:** 2026-09-18  
**Status:** Accepted

### Context
The AI analysis needs to be machine-readable for the frontend SVG overlay,
safety lock system, and lab report engine.

### Decision
**The Gemini prompt instructs the model to respond ONLY with a JSON object.**
The backend attempts `json.loads()` on the response and falls back to
wrapping raw text if parsing fails.

### Why
- Downstream consumers (SVG renderer, safety checker) need structured data
- JSON is the most reliable format for LLM structured output
- The fallback ensures the pipeline never crashes on malformed AI output
- The JSON schema includes: `components`, `connections`, `errors`,
  `safety_hazards`, `confidence`, and `summary`

### What Was Built
- `CIRCUIT_ANALYSIS_PROMPT` in `gemini_client.py` with JSON schema
- JSON parse + fallback in `POST /api/analyze`

---

## Decision 007 — Dual Analysis Modes (Single-Shot + SSE Streaming)
**Date:** 2026-09-18  
**Status:** Accepted

### Context
The spec calls for "token-by-token streaming via SSE" for snappy UX.
But some consumers (like the lab report engine) need the complete
JSON response at once.

### Decision
**Two endpoints: `/api/analyze` (complete JSON) and `/api/analyze/stream` (SSE).**

### Why
- The frontend can use SSE streaming for the live "typing" experience
- Backend consumers and testing tools use the single-shot endpoint
- Both share the same pipeline logic (S3 → Roboflow → OCR → Gemini)
- The streaming endpoint uses `StreamingResponse` with `text/event-stream`
  and `X-Accel-Buffering: no` for proper proxy behavior

### What Was Built
- `POST /api/analyze` — returns complete `{analysis, ocr, detections}`
- `POST /api/analyze/stream` — returns SSE event stream
- `GeminiService.analyze_circuit()` (sync) and `.analyze_circuit_stream()` (async gen)

---

## Decision 008 — Backend File Architecture
**Date:** 2026-09-18  
**Status:** Accepted

### What Was Built

```
backend/
├── .env                  # Credentials (git-ignored)
├── config.py             # Pydantic settings loader
├── main.py               # FastAPI app + all endpoints
├── aws_services.py       # S3 + Rekognition service classes
├── gemini_client.py      # Gemini multimodal analysis
├── roboflow_client.py    # Roboflow detection (mock + real)
├── test_aws.py           # Health check for all services
├── requirements.txt      # Python dependencies
└── venv/                 # Virtual environment
```

### Why This Structure
- **One file per external service** — easy to find, easy to test
- **`config.py` as the single entry point** for all configuration
- **`main.py` as the orchestrator** — imports services, wires routes
- **No nested packages** — flat structure for hackathon speed
- **Service classes with module-level singletons** — initialized once,
  imported everywhere
