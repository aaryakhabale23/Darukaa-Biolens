/* eslint-disable no-console */
/**
 * @module ml/preprocess
 * @description Image preprocessing pipeline for plant identification.
 *
 * Resizes an input image to the model's expected 224×224 resolution,
 * decodes it from base64 JPEG, and produces a Float32Array tensor
 * normalized to the [-1, 1] range expected by MobileNet-v2.
 */

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';

// ── Constants ──────────────────────────────────────────────────────────

/** Width & height the model expects (MobileNet-v2 default). */
export const MODEL_INPUT_SIZE = 224;

/** Number of colour channels (RGB). */
export const MODEL_INPUT_CHANNELS = 3;

/** Total number of float values in the input tensor [1, 224, 224, 3]. */
export const MODEL_INPUT_LENGTH = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * MODEL_INPUT_CHANNELS;

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Pre-process a captured or gallery image for TFLite inference.
 *
 * 1. Resizes the image to 224 × 224 px.
 * 2. Exports it as a lossless-quality JPEG with base64 data.
 * 3. Decodes the base64 string to a binary JPEG byte array.
 * 4. Uses jpeg-js to decode the JPEG bytes into a raw RGBA Uint8Array.
 * 5. Extracts the RGB channels and normalizes them to [-1, 1].
 *
 * @param uri - Local file URI (e.g. `file:///…/photo.jpg`) or a
 *              base64 data-URI of the source image.
 * @returns A `Float32Array` of length 150 528 (224 × 224 × 3) with
 *          values in the range [-1, 1].
 */
export async function preprocessImage(uri: string): Promise<Float32Array> {
  // ── 1. Resize & encode ───────────────────────────────────────────
  const resized = await manipulateAsync(
    uri,
    [{ resize: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE } }],
    { compress: 1, format: SaveFormat.JPEG, base64: true },
  );

  if (!resized.base64) {
    throw new Error(
      '[preprocess] Image manipulation returned no base64 data. ' +
        'Ensure the source URI is valid and the device has enough storage.',
    );
  }

  // ── 2. Base64 → raw JPEG bytes ────────────────────────────────────
  const jpegBytes = decodeBase64(resized.base64);

  // ── 3. Decode JPEG to raw RGBA ───────────────────────────────────
  let decoded;
  try {
    decoded = jpeg.decode(jpegBytes, { useTArray: true });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`[preprocess] Failed to decode JPEG data: ${errMsg}`);
  }

  const { width, height, data } = decoded;
  if (width !== MODEL_INPUT_SIZE || height !== MODEL_INPUT_SIZE) {
    throw new Error(
      `[preprocess] Unexpected decoded dimensions: ${width}x${height} ` +
        `(expected ${MODEL_INPUT_SIZE}x${MODEL_INPUT_SIZE})`,
    );
  }

  // ── 4. Extract RGB and normalize to [-1, 1] ──────────────────────
  const tensor = new Float32Array(MODEL_INPUT_LENGTH);

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;

  // Decoded data contains sequential RGBA bytes. Map to RGB output tensor.
  for (let i = 0; i < MODEL_INPUT_SIZE * MODEL_INPUT_SIZE; i++) {
    const rawIdx = i * 4;
    const tensorIdx = i * 3;

    const r = data[rawIdx]!;
    const g = data[rawIdx + 1]!;
    const b = data[rawIdx + 2]!;

    rSum += r;
    gSum += g;
    bSum += b;

    tensor[tensorIdx] = r / 127.5 - 1.0; // R
    tensor[tensorIdx + 1] = g / 127.5 - 1.0; // G
    tensor[tensorIdx + 2] = b / 127.5 - 1.0; // B
  }

  if (__DEV__) {
    const numPixels = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
    console.log(
      `[preprocess] Decoded image stats - Mean R: ${(rSum / numPixels).toFixed(1)}, ` +
        `G: ${(gSum / numPixels).toFixed(1)}, B: ${(bSum / numPixels).toFixed(1)}`,
    );
  }

  return tensor;
}

// ── Internal helpers ───────────────────────────────────────────────────

function decodeBase64(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)!] = i;
  }

  const cleaned = base64
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/=+$/, '')
    .replace(/\s/g, '');
  const len = cleaned.length;
  const byteLength = Math.floor((len * 3) / 4);
  const bytes = new Uint8Array(byteLength);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const chunk =
      (lookup[cleaned.charCodeAt(i)!]! << 18) |
      (lookup[cleaned.charCodeAt(i + 1)!]! << 12) |
      ((i + 2 < len ? lookup[cleaned.charCodeAt(i + 2)!]! : 0) << 6) |
      (i + 3 < len ? lookup[cleaned.charCodeAt(i + 3)!]! : 0);

    bytes[p++] = (chunk >> 16) & 255;
    if (i + 2 < len) bytes[p++] = (chunk >> 8) & 255;
    if (i + 3 < len) bytes[p++] = chunk & 255;
  }

  return bytes;
}
