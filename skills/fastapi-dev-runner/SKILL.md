---
name: fastapi-dev-runner
description: >-
  Starts the FastAPI development server from the backend directory.
  Use this skill when the user asks to run, start, or launch the backend
  server, or when they need to restart it with different options like a
  custom port or auto-reload.
---

# FastAPI Dev Runner

Start the FastAPI development server using the backend virtual environment.

## Prerequisites

- Python 3.10+ available on `PATH`.
- The backend virtual environment at `backend/venv` must exist.
- Dependencies installed (`pip install -r backend/requirements.txt`).
- The FastAPI app entrypoint must be `backend/main.py` with an `app` object.

## Usage

Run the launcher script
[start_server.ps1](./scripts/start_server.ps1) from the **repository root**:

```powershell
# Default: port 8000, reload enabled
powershell -ExecutionPolicy Bypass -File skills/fastapi-dev-runner/scripts/start_server.ps1

# Custom port
powershell -ExecutionPolicy Bypass -File skills/fastapi-dev-runner/scripts/start_server.ps1 -Port 8080

# Disable auto-reload (e.g. for demo mode)
powershell -ExecutionPolicy Bypass -File skills/fastapi-dev-runner/scripts/start_server.ps1 -NoReload

# Both
powershell -ExecutionPolicy Bypass -File skills/fastapi-dev-runner/scripts/start_server.ps1 -Port 3001 -NoReload
```

### Arguments Reference

| Argument    | Type   | Default | Description                                    |
| ----------- | ------ | ------- | ---------------------------------------------- |
| `-Port`     | int    | `8000`  | The port uvicorn listens on.                   |
| `-NoReload` | switch | off     | When present, disables `--reload` on uvicorn.  |

## What the Script Does

1. Activates `backend/venv`.
2. Runs `uvicorn main:app --host 0.0.0.0 --port <PORT>` with optional
   `--reload`.
3. Streams uvicorn output to the terminal.

## Generating the Correct CLI Invocation

When the user asks to "start the backend" or "run the server":

- **Default request** → run with no extra flags (port 8000, reload on).
- **"on port X"** → add `-Port X`.
- **"without reload" / "production mode"** → add `-NoReload`.
- **"restart"** → kill any existing uvicorn process first, then re-launch.

## Cross-Platform Note

On macOS/Linux, use the bash equivalent:

```bash
bash skills/fastapi-dev-runner/scripts/start_server.sh          # defaults
bash skills/fastapi-dev-runner/scripts/start_server.sh --port 8080
bash skills/fastapi-dev-runner/scripts/start_server.sh --no-reload
```
