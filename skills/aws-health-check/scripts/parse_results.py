#!/usr/bin/env python3
"""Parse the output of test_aws.py and emit a JSON summary.

Usage:
    python backend/test_aws.py | python skills/aws-health-check/scripts/parse_results.py

Reads lines like:
    [PASS] S3 — Listed 3 buckets
    [FAIL] Rekognition — NoCredentialsError: Unable to locate credentials

Outputs a JSON object with per-service status and an overall verdict.
"""

import json
import re
import sys


LINE_RE = re.compile(
    r"^\[(PASS|FAIL)\]\s+(\S+)\s*(?:\u2014|\u2013|—|--|-|[�\uFFFD]+)\s*(.+)$",
    re.IGNORECASE,
)


def parse(lines: list[str]) -> dict:
    services: dict[str, dict[str, str]] = {}
    for line in lines:
        m = LINE_RE.match(line.strip())
        if m:
            status, name, detail = m.group(1).upper(), m.group(2), m.group(3).strip()
            services[name] = {"status": status, "detail": detail}

    overall = "PASS" if all(s["status"] == "PASS" for s in services.values()) else "FAIL"
    if not services:
        overall = "NO_OUTPUT"

    return {"overall": overall, "services": services}


def main() -> None:
    lines = sys.stdin.read().splitlines()
    result = parse(lines)
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["overall"] == "PASS" else 1)


if __name__ == "__main__":
    main()
