"""AWS service clients for CircuitLens.

Provides S3 (image upload/download + pre-signed URLs)
and Rekognition (OCR text detection on breadboard images).

Both services are initialized with credentials from config.py
so they work identically in local dev and deployed environments.
"""

import boto3
import uuid
from config import settings


# =========================================================================
# S3 Service — Image storage with pre-signed URL uploads
# =========================================================================

class S3Service:
    """Handles all interactions with the S3 image bucket."""

    def __init__(self):
        self.client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_DEFAULT_REGION,
        )
        self.bucket = settings.S3_BUCKET_NAME

    def generate_presigned_upload_url(
        self, filename: str, content_type: str = "image/jpeg"
    ) -> tuple[str, str]:
        """Generate a pre-signed PUT URL for direct browser upload.

        Returns:
            (upload_url, s3_key) — the URL the frontend PUTs to,
            and the key to reference the object afterwards.
        """
        # Prefix with uploads/ and a UUID to avoid collisions
        safe_name = filename.replace(" ", "_")
        key = f"uploads/{uuid.uuid4().hex[:8]}_{safe_name}"

        url = self.client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=300,  # 5 minutes
        )
        return url, key

    def download_image(self, key: str) -> bytes:
        """Download an image from S3 by its key. Returns raw bytes."""
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"].read()

    def generate_presigned_read_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate a pre-signed GET URL for reading/displaying an image."""
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    def check_connection(self) -> dict:
        """Quick connectivity check. Returns status dict."""
        try:
            self.client.head_bucket(Bucket=self.bucket)
            return {"status": "PASS", "detail": f"Bucket '{self.bucket}' accessible"}
        except Exception as exc:
            return {"status": "FAIL", "detail": f"{type(exc).__name__}: {exc}"}


# =========================================================================
# Rekognition Service — OCR text detection
# =========================================================================

class RekognitionService:
    """Extracts printed text from breadboard images using AWS Rekognition."""

    def __init__(self):
        self.client = boto3.client(
            "rekognition",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_DEFAULT_REGION,
        )

    def detect_text(self, s3_key: str) -> list[dict]:
        """Detect text in an S3 image. Returns list of text detections.

        Each detection includes:
          - text: the detected string
          - confidence: float 0-100
          - type: "LINE" or "WORD"
          - bbox: bounding box dict {Width, Height, Left, Top}
        """
        response = self.client.detect_text(
            Image={
                "S3Object": {
                    "Bucket": settings.S3_BUCKET_NAME,
                    "Name": s3_key,
                }
            }
        )
        return [
            {
                "text": det["DetectedText"],
                "confidence": round(det["Confidence"], 2),
                "type": det["Type"],
                "bbox": det.get("Geometry", {}).get("BoundingBox"),
            }
            for det in response.get("TextDetections", [])
        ]

    def detect_text_from_bytes(self, image_bytes: bytes) -> list[dict]:
        """Detect text from raw image bytes (no S3 required)."""
        response = self.client.detect_text(
            Image={"Bytes": image_bytes}
        )
        return [
            {
                "text": det["DetectedText"],
                "confidence": round(det["Confidence"], 2),
                "type": det["Type"],
                "bbox": det.get("Geometry", {}).get("BoundingBox"),
            }
            for det in response.get("TextDetections", [])
        ]

    def check_connection(self) -> dict:
        """Quick connectivity check."""
        try:
            self.client.list_collections(MaxResults=1)
            return {"status": "PASS", "detail": "Rekognition API reachable"}
        except Exception as exc:
            return {"status": "FAIL", "detail": f"{type(exc).__name__}: {exc}"}


# -------------------------------------------------------------------------
# Module-level singletons
# -------------------------------------------------------------------------
s3_service = S3Service()
rekognition_service = RekognitionService()
