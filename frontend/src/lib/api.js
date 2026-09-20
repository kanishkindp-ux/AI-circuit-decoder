import imageCompression from 'browser-image-compression';

// Dynamically route to backend using the current hostname
const API_BASE = `http://${window.location.hostname}:8000`;

/**
 * Compress an image File before upload.
 * Returns a compressed Blob (not base64 — we upload raw bytes to S3).
 */
export async function compressImage(file) {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/jpeg',
  };
  return imageCompression(file, options);
}

/**
 * Step 1: Get a pre-signed PUT URL from the backend.
 *
 * @param {string} filename — original filename
 * @param {string} contentType — MIME type (default: image/jpeg)
 * @returns {Promise<{ upload_url: string, s3_key: string, bucket: string }>}
 */
export async function getUploadUrl(filename, contentType = 'image/jpeg') {
  const res = await fetch(`${API_BASE}/api/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, content_type: contentType }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Failed to get upload URL (${res.status}): ${errBody}`);
  }

  return res.json();
}

/**
 * Step 2: Upload the image directly to S3 via the pre-signed URL.
 * The file never touches the backend — browser → S3 directly.
 *
 * @param {string} uploadUrl — pre-signed PUT URL
 * @param {Blob} fileBlob — compressed image blob
 * @param {string} contentType — MIME type
 */
export async function uploadToS3(uploadUrl, fileBlob, contentType = 'image/jpeg') {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: fileBlob,
  });

  if (!res.ok) {
    throw new Error(`S3 upload failed (${res.status}): ${res.statusText}`);
  }
}

/**
 * Step 3: Trigger circuit analysis on the uploaded S3 image.
 *
 * @param {string} s3Key — the key returned from getUploadUrl
 * @param {Object} [options]
 * @param {string} [options.labContext] — optional lab manual text context
 * @returns {Promise<{ analysis: Object, ocr: Array, detections: Object }>}
 */
export async function analyzeCircuit(s3Key, options = {}) {
  const body = {
    s3_key: s3Key,
  };

  if (options.labContext) {
    body.lab_context = options.labContext;
  }

  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Analysis failed (${res.status}): ${errBody}`);
  }

  return res.json();
}

/**
 * Full pipeline helper: compress → get presigned URL → upload to S3 → analyze.
 *
 * @param {File} circuitFile — the breadboard photo
 * @param {Object} [options]
 * @param {string} [options.labContext] — optional lab context text
 * @param {(stage: string) => void} [options.onProgress] — progress callback
 * @returns {Promise<{ analysis: Object, ocr: Array, detections: Object, s3Key: string }>}
 */
export async function runFullPipeline(circuitFile, options = {}) {
  const { labContext, onProgress } = options;

  // 1. Compress
  onProgress?.('Compressing image…');
  const compressed = await compressImage(circuitFile);

  // 2. Get pre-signed URL
  onProgress?.('Preparing upload…');
  const { upload_url, s3_key } = await getUploadUrl(
    circuitFile.name,
    'image/jpeg'
  );

  // 3. Direct upload to S3 (browser → S3, zero backend load)
  onProgress?.('Uploading to cloud…');
  await uploadToS3(upload_url, compressed, 'image/jpeg');

  // 4. Trigger analysis
  onProgress?.('Analyzing circuit…');
  const result = await analyzeCircuit(s3_key, { labContext });

  return { ...result, s3Key: s3_key };
}
