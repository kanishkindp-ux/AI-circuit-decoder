---
name: aws-health-check
description: >-
  Verifies connectivity to all cloud services used in the hackathon project:
  AWS S3, AWS Rekognition, AWS Bedrock, and Roboflow.
  Use this skill when the user asks to check cloud connectivity, verify AWS
  credentials, test service health, or diagnose cloud integration failures.
---

# AWS Health Check

Run the cloud-connectivity test suite and return a clean pass/fail summary for
every service the hackathon backend depends on.

## Prerequisites

- Python 3.10+ available on `PATH`.
- The backend virtual environment at `backend/venv` must exist. If it does not,
  create it first (`python -m venv backend/venv`).
- AWS credentials must be configured (either via `backend/.env`, environment
  variables, or `~/.aws/credentials`).
- A `ROBOFLOW_API_KEY` must be set in `backend/.env` or as an environment
  variable.

## Steps

1. **Run the test script** from the repository root:

   ```bash
   # Windows (PowerShell)
   & backend/venv/Scripts/python.exe backend/test_aws.py

   # macOS / Linux
   backend/venv/bin/python backend/test_aws.py
   ```

   The script tests four services in order: **S3**, **Rekognition**,
   **Bedrock**, and **Roboflow**. Each test prints a line in the format:

   ```
   [PASS] S3 — Listed N buckets
   [FAIL] Rekognition — NoCredentialsError: Unable to locate credentials
   ```

2. **Parse the output** using the helper script
   [parse_results.py](./scripts/parse_results.py). Pipe the test output into it
   to get a structured JSON summary:

   ```bash
   backend/venv/Scripts/python.exe backend/test_aws.py | python skills/aws-health-check/scripts/parse_results.py
   ```

   Example JSON output:

   ```json
   {
     "overall": "FAIL",
     "services": {
       "S3": { "status": "PASS", "detail": "Listed 3 buckets" },
       "Rekognition": { "status": "FAIL", "detail": "NoCredentialsError" },
       "Bedrock": { "status": "PASS", "detail": "Model list retrieved" },
       "Roboflow": { "status": "FAIL", "detail": "401 Unauthorized" }
     }
   }
   ```

3. **Report the results** to the user. If any service shows `FAIL`, highlight it
   prominently and suggest remediation (missing credentials, wrong region, etc.).

## Interpreting Common Failures

| Error Pattern                     | Likely Cause                          | Fix                                                  |
| --------------------------------- | ------------------------------------- | ---------------------------------------------------- |
| `NoCredentialsError`              | AWS creds not configured              | Run `aws configure` or populate `backend/.env`       |
| `EndpointConnectionError`         | Wrong AWS region                      | Set `AWS_DEFAULT_REGION` to `us-east-1`              |
| `AccessDeniedException` (Bedrock) | Model access not enabled              | Enable model access in the Bedrock console            |
| `401 Unauthorized` (Roboflow)     | Invalid or missing Roboflow API key   | Set `ROBOFLOW_API_KEY` in `backend/.env`             |
