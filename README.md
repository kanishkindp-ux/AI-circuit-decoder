# CircuitLens 🔍

> Real-time physical breadboard debugging, multimodal circuit tracing, and automated academic lab report generation powered by computer vision and Gemini 2.5 Flash.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.0+-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5.0+-646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev)
[![Gemini 2.5 Flash](https://img.shields.io/badge/Google%20GenAI-Gemini%202.5%20Flash-8E75C2.svg?style=flat&logo=google&logoColor=white)](https://ai.google.dev/)
[![Roboflow](https://img.shields.io/badge/Roboflow-RF--DETR%20Small-9900FF.svg?style=flat&logo=roboflow&logoColor=white)](https://roboflow.com)
[![AWS S3](https://img.shields.io/badge/AWS-S3%20Storage-232F3E.svg?style=flat&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/s3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Key Features](#key-features)
- [Hardware Test Rig](#hardware-test-rig)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Installation & Local Run](#installation--local-run)
- [API Reference](#api-reference)
- [Demo Scenarios & Injected Faults](#demo-scenarios--injected-faults)
- [Troubleshooting & Gotchas](#troubleshooting--gotchas)
- [License](#license)

---

## Overview

Physical circuit prototyping on solderless breadboards is notoriously error-prone:
- Reversed ground/power rails destroy active components.
- Floating leads and loose jumper connections create silent open circuits.
- Students and engineers spend significant lab time debugging wiring flaws and manually writing standardized lab reports.

**CircuitLens** resolves this through an end-to-end multimodal pipeline:
1. Takes a top-down smartphone photograph of any physical breadboard alongside reference pages from a physical lab manual.
2. Identifies rigid discrete components and ICs using a custom-trained Roboflow RF-DETR Small model.
3. Feeds bounding boxes, spatial coordinates, and lab manual text into **Gemini 2.5 Flash** using the `google-genai` SDK.
4. Gemini traces the electrical loop, flags safety hazards (e.g., short circuits, backward rails, floating legs), verifies schematic parity, and outputs a ready-to-export PDF lab report (Aim, Theory, Procedure, Observation Table, and Diagnostics).

---

## System Architecture

```text
  [ Physical Breadboard ]       [ Lab Manual Pages ]
             │                            │
             └─────────────┬──────────────┘
                           │ Top-Down High-Res Images
                           ▼
             ┌───────────────────────────┐
             │   React + Vite Frontend   │
             │  (UploadZone, Canvas SVG) │
             └─────────────┬─────────────┘
                           │ Base64 Payload + User Verification
                           ▼
             ┌───────────────────────────┐
             │      FastAPI Backend      │
             │         (main.py)         │
             └──────┬─────────────┬──────┘
                    │             │
   Stage 1: Hardware Detection    │ Stage 2: Spatial & Circuit Reasoning
                    │             │
                    ▼             ▼
       ┌─────────────────┐   ┌─────────────────────────────┐
       │ Roboflow Server │   │       Gemini 2.5 Flash      │
       │  RF-DETR Small  │   │     (`google-genai` SDK)    │
       │ (18-Class Body) │   │                             │
       └────────┬────────┘   │ • Traces wire connectivity  │
                │            │ • Detects floating leads    │
                │ Bounding   │ • Compares with lab manual  │
                │ Boxes      │ • Emits Netlist & Report MD │
                └───────────►└──────────────┬──────────────┘
                                            │
                                            ▼
                             ┌─────────────────────────────┐
                             │       FastAPI Response      │
                             │  - Detected Components      │
                             │  - SVG Netlist Paths        │
                             │  - Generated Lab Report MD  │
                             └──────────────┬──────────────┘
                                            │
                                            ▼
                             ┌─────────────────────────────┐
                             │   React Client Rendering    │
                             │ • Editable Component Banner │
                             │ • Interactive SVG Breadboard│
                             │ • Export-to-PDF Lab Report  │
                             └─────────────────────────────┘
```

---

## Key Features

- **Dual Image Ingestion:** Simultaneous upload support for circuit photographs and multi-page lab manual documentation.
- **Dedicated Component Detector:** Custom Roboflow RF-DETR model trained on an 18-class ontology isolating component bodies (DIP ICs, LEDs, resistors, buzzers, capacitors) while explicitly ignoring loose jumper wires to avoid occlusions.
- **Human-in-the-Loop Component Banner:** Editable detections at the top of the UI. If a user corrects a component label (e.g., `220Ω Resistor` vs `10kΩ Resistor`), the UI re-evaluates the circuit without re-uploading images.
- **Aggressive Circuit Bug Hunter:** Gemini 2.5 Flash evaluates electrical continuity with high scrutiny:
  - Detects floating pins (legs inserted into empty rows without loops).
  - Detects reversed power rails (e.g., GND wire plugged into the red `+` bus).
  - Flags reverse polarity on diodes, LEDs, and electrolytic capacitors.
- **Interactive SVG Breadboard Visualizer:** Renders an interactive 400-point breadboard graphic overlaying colored wire vectors directly onto detected coordinates:
  - 🟢 Green: Verified closed-loop paths.
  - 🟡 Yellow: Low-confidence / non-standard pin placement.
  - 🔴 Red: Critical error, floating pin, or short circuit.
- **Publication-Ready Lab Report Generation:** Generates comprehensive lab reports matching academic formats (Aim, Theory, Apparatus Required, Circuit Diagram Netlist, Step-by-Step Procedure, Observation Table, and Troubleshooting Log) with a 1-click PDF export via `html2pdf.js`.

---

## Hardware Test Rig

Our baseline test circuit runs on an **Arduino Uno** configured with deliberate hardware bugs to benchmark diagnostic accuracy:

| Component | Physical Location | Intentional State / Fault Trigger |
| :--- | :--- | :--- |
| **Microcontroller** | Arduino Uno Rev3 | Powered over USB, outputting digital signals on Pins 8, 9, 10. |
| **LED 1 (Red)** | Rows 28-29, Column F | Functional; paired with current-limiting resistor to ground. |
| **LED 2 (Red)** | Rows 18-19, Column F | **Missing Resistor Bug:** Driven directly without a resistor. |
| **Resistor** | Row 27 to Ground Rail | 220Ω current-limiting resistor. |
| **Active Buzzer** | Rows 1-13, Column E-F | **Open Circuit Bug:** Driven by Pin 8, but connected to an unpowered rail. |
| **Power Rails** | Left & Right Vertical Buses | **Reversed Polarity Bug:** Arduino `GND` mapped to Red `(+)` bus. |

---

## Tech Stack

### Frontend
- **Framework:** React 18 (Vite)
- **Language:** JavaScript (ES6+)
- **Styling:** Tailwind CSS (Slate & Indigo minimal academic design system)
- **Icons:** Lucide React
- **Export Utility:** `html2pdf.js` / standard print CSS
- **Markdown Renderer:** `react-markdown`

### Backend
- **Framework:** FastAPI (Python 3.10+)
- **Server:** Uvicorn (Asynchronous ASGI)
- **Data Validation:** Pydantic v2 & Pydantic Settings
- **AI / Multimodal:** `google-genai` SDK (Gemini 2.5 Flash)
- **Computer Vision API:** Roboflow Serverless Workflows REST API
- **Cloud Storage:** Amazon Web Services (AWS S3) via `boto3`

---

## Repository Structure

```text
AI-circuit-decoder/
├── .gitignore
├── README.md
│
├── backend/
│   ├── .env.example
│   ├── config.py                 # Pydantic environment configurations
│   ├── gemini_client.py          # Multimodal Gemini 2.5 Flash service
│   ├── roboflow_client.py        # RF-DETR Workflows API integration
│   ├── aws_services.py           # S3 bucket upload & artifact storage
│   ├── main.py                   # FastAPI application & /api/diagnostic router
│   ├── requirements.txt          # Python dependencies
│   └── test_aws.py               # Pre-flight credential verification script
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx               # Application state coordinator
│       ├── index.css
│       ├── components/
│       │   ├── UploadZone.jsx    # Dual dropzone for circuit & manual images
│       │   ├── ComponentBanner.jsx # Editable human-in-the-loop component row
│       │   ├── SvgOverlay.jsx    # SVG 400-point breadboard wire visualizer
│       │   └── LabReport.jsx     # Markdown renderer with 1-click PDF download
│       └── lib/
│           └── api.js            # Axios client communicating with FastAPI
│
├── docs/
│   └── decision-log.md           # Architecture evolution & pivot history
└── skills/                       # Antigravity IDE custom agent skills
    ├── aws-health-check/
    ├── fastapi-dev-runner/
    └── frontend-health-check/
```

---

## Prerequisites

- **Python:** Version `3.10` or higher
- **Node.js:** Version `18.0.0` or higher (with `npm`)
- **Package Manager:** `pip` and `npm`
- **API Keys Required:**
  - Google Gemini API Key ([Google AI Studio](https://aistudio.google.com/))
  - Roboflow API Key & Workflow ID ([Roboflow](https://roboflow.com/))
  - AWS Access Key & Secret Key (IAM user with `AmazonS3FullAccess`)

---

## Environment Configuration

Create a `.env` file in the `/backend` directory. 

> **CRITICAL SECURITY NOTE:** Never commit `.env` to Git. Ensure `.env` is listed inside `.gitignore`.

```env
# ==============================================================================
# CircuitLens Backend Environment Variables
# ==============================================================================

# Google Gemini API
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere

# Roboflow Inference API
ROBOFLOW_API_KEY=your_roboflow_api_key
ROBOFLOW_WORKFLOW_URL=[https://serverless.roboflow.com/kanishk-sharma-4yrkt/workflows/circuitlens-hgrfp](https://serverless.roboflow.com/kanishk-sharma-4yrkt/workflows/circuitlens-hgrfp)

# Amazon Web Services (AWS) S3
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=circuitlens-artifacts-bucket
```

---

## Installation & Local Run

### 1. Clone the Repository
```bash
git clone [https://github.com/kanishkindp-ux/AI-circuit-decoder.git](https://github.com/kanishkindp-ux/AI-circuit-decoder.git)
cd AI-circuit-decoder
```

### 2. Backend Setup (FastAPI)
Open a terminal in the root directory:

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run pre-flight smoke test
python test_aws.py

# Start FastAPI server on port 8000
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
The interactive Swagger API documentation will be available at: `http://localhost:8000/docs`

### 3. Frontend Setup (React + Vite)
Open a second terminal:

```bash
# Navigate to frontend
cd frontend

# Install packages
npm install

# Start Vite development server
npm run dev
```
Open your browser and navigate to: `http://localhost:5173`

---

## API Reference

### Diagnostics Endpoint

Executes the full computer vision and multimodal reasoning diagnostic on an uploaded circuit.

- **URL:** `/api/diagnostic`
- **Method:** `POST`
- **Content-Type:** `application/json`

#### Request Payload
```json
{
  "circuitImage": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "labManualImages": [
    "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  ],
  "verifiedComponents": [
    {
      "id": "comp-1",
      "name": "Breadboard",
      "type": "breadboard"
    },
    {
      "id": "comp-2",
      "name": "220Ω Resistor",
      "type": "resistor"
    }
  ]
}
```

#### Response Payload
```json
{
  "circuit_type": "Dual LED Output with Piezo Buzzer Alert",
  "detected_components": [
    {
      "id": "comp-1",
      "name": "Breadboard",
      "type": "breadboard",
      "confidence": 1.0,
      "rect": { "x": 531, "y": 774.5, "w": 618, "h": 925 }
    },
    {
      "id": "comp-2",
      "name": "220Ω Resistor",
      "type": "resistor",
      "confidence": 0.98,
      "rect": { "x": 343, "y": 678, "w": 82, "h": 34 }
    },
    {
      "id": "comp-3",
      "name": "Red LED",
      "type": "led",
      "confidence": 1.0,
      "rect": { "x": 277.5, "y": 425.5, "w": 85, "h": 123 }
    }
  ],
  "svg_netlist": [
    {
      "from": "Pin 10",
      "to": "Row 28 Col F",
      "color": "emerald-500",
      "status": "verified"
    },
    {
      "from": "Pin 8",
      "to": "Row 15 Col E",
      "color": "rose-500",
      "status": "error",
      "note": "Buzzer connected to open rail without complete ground return."
    }
  ],
  "errors": [
    {
      "severity": "critical",
      "description": "Buzzer circuit loop is incomplete. Red lead connects to unpowered rail.",
      "fix": "Move the buzzer ground lead to the shared negative rail on the left side."
    },
    {
      "severity": "warning",
      "description": "Arduino GND is plugged into the red (+) rail header.",
      "fix": "Move ground lead to blue (-) bus to avoid accidental short circuits."
    }
  ],
  "generated_report_md": "# Experiment: Digital Output Interfacing\n\n## Aim\nTo interface dual LEDs and an active buzzer with an Arduino Uno...\n\n## Theory\n..."
}
```

---

## Demo Scenarios & Injected Faults

CircuitLens was evaluated against the following injected physical hardware bugs:

| Fault Case | Visual Appearance | CircuitLens Verdict |
| :--- | :--- | :--- |
| **Inverted Ground Rail** | Purple wire from Arduino `GND` inserted into red `(+)` stripe rail. | **Warning:** Non-standard bus configuration detected. High risk of power-to-ground bridge if 5V is inserted. |
| **Unpowered Rail Floating Buzzer** | Brown lead connects Arduino Pin 8 to Buzzer; Buzzer return lead drops into isolated right rail. | **Critical Error:** Open circuit. Active buzzer has no complete return path to ground. |
| **Missing Current Limiter** | Top LED has 220Ω resistor; middle LED connects directly from Pin 9 to GND. | **Critical Error:** Missing current-limiting resistor on LED 2. Risk of LED failure and GPIO pin overcurrent. |

---

## Troubleshooting & Gotchas

### 1. GitHub Push Protection Block (`GH013`)
If GitHub blocks your push with `Push cannot contain secrets`:
```powershell
# Stop tracking the local .env without deleting the file
git rm --cached backend/.env
echo "backend/.env" >> .gitignore
git add .gitignore
git commit --amend -m "Clean secrets from history"
git push origin main
```

### 2. Arduino Upload Freezes (`avrdude: stk500_recv(): programmer is not responding`)
- Ensure the Arduino Serial Monitor window is closed.
- If digital pins 0 (`RX`) and 1 (`TX`) have jumper wires plugged in, disconnect them during sketch upload, as they share the hardware UART line with the USB interface.

### 3. FastAPI CORS Errors in the React Console
If requests fail with `No 'Access-Control-Allow-Origin' header present`:
Ensure `main.py` has CORS middleware configured before route declarations:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---
