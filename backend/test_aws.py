#!/usr/bin/env python3
"""Cloud-connectivity smoke tests for the CircuitLens backend.

Tests: S3, Rekognition, Gemini, Roboflow.

Each test prints a line in the format:
    [PASS] ServiceName -- human-readable detail
    [FAIL] ServiceName -- error description
    [SKIP] ServiceName -- reason for skip

Exit code 0 if all pass/skip, 1 otherwise.
"""

import os
import sys

# ---------------------------------------------------------------------------
# Load .env from the backend directory
# ---------------------------------------------------------------------------
_backend_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_backend_dir, ".env")

try:
    from dotenv import load_dotenv
    load_dotenv(_env_path)
except ImportError:
    if os.path.isfile(_env_path):
        with open(_env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())


all_passed = True


def _report(service: str, status: str, detail: str) -> None:
    global all_passed
    if status == "FAIL":
        all_passed = False
    print(f"[{status}] {service} -- {detail}")


# ---------------------------------------------------------------------------
# 1. S3
# ---------------------------------------------------------------------------
def test_s3() -> None:
    try:
        import boto3
        s3 = boto3.client(
            "s3",
            aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
            region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
        )
        bucket = os.environ.get("S3_BUCKET_NAME", "")
        if bucket:
            s3.head_bucket(Bucket=bucket)
            _report("S3", "PASS", f"Bucket '{bucket}' accessible")
        else:
            buckets = s3.list_buckets().get("Buckets", [])
            _report("S3", "PASS", f"Listed {len(buckets)} bucket(s)")
    except Exception as exc:
        _report("S3", "FAIL", f"{type(exc).__name__}: {exc}")


# ---------------------------------------------------------------------------
# 2. Rekognition
# ---------------------------------------------------------------------------
def test_rekognition() -> None:
    try:
        import boto3
        rek = boto3.client(
            "rekognition",
            aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
            region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
        )
        resp = rek.list_collections(MaxResults=1)
        count = len(resp.get("CollectionIds", []))
        _report("Rekognition", "PASS", f"API reachable (collections: {count})")
    except Exception as exc:
        _report("Rekognition", "FAIL", f"{type(exc).__name__}: {exc}")


# ---------------------------------------------------------------------------
# 3. Gemini
# ---------------------------------------------------------------------------
def test_gemini() -> None:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        _report("Gemini", "FAIL", "GEMINI_API_KEY not set in environment")
        return
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents="Respond with only the word: OK",
        )
        text = response.text.strip()[:30]
        _report("Gemini", "PASS", f"Model responded: '{text}'")
    except Exception as exc:
        _report("Gemini", "FAIL", f"{type(exc).__name__}: {exc}")


# ---------------------------------------------------------------------------
# 4. Roboflow
# ---------------------------------------------------------------------------
def test_roboflow() -> None:
    api_key = os.environ.get("ROBOFLOW_API_KEY", "")
    if not api_key:
        _report("Roboflow", "SKIP", "ROBOFLOW_API_KEY not set (using mock detections)")
        return
    try:
        import urllib.request
        import json as _json
        url = f"https://api.roboflow.com/?api_key={api_key}"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = _json.loads(resp.read())
            workspace = data.get("workspace", "unknown")
            _report("Roboflow", "PASS", f"Authenticated to workspace '{workspace}'")
    except Exception as exc:
        _report("Roboflow", "FAIL", f"{type(exc).__name__}: {exc}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 50)
    print("  CircuitLens — Cloud Health Check")
    print("=" * 50)
    print()
    test_s3()
    test_rekognition()
    test_gemini()
    test_roboflow()
    print()
    if all_passed:
        print("RESULT: All services operational")
    else:
        print("RESULT: Some services failed (see above)")
    sys.exit(0 if all_passed else 1)
