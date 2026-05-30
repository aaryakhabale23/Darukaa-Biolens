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
 * 2. Exports it as a JPEG with embedded base64 data.
 * 3. Decodes the base64 JPEG bytes using jpeg-js to get raw RGBA pixels.
 * 4. Normalises the RGB channels to `[-1, 1]` using `(pixel / 127.5) - 1.0`.
 *
 * The returned `Float32Array` can be passed directly into the model's
 * `run()` method after wrapping it in an `ArrayBuffer[]`.
 *
 * @param uri - Local file URI (e.g. `file:///…/photo.jpg`) or a
 *              base64 data-URI of the source image.
 * @returns A `Float32Array` of length 150 528 (224 × 224 × 3) with
 *          values in the range [-1, 1].
 *
 * @throws {Error} If the image manipulation fails or the JPEG decoding fails.
 */
export async function preprocessImage(uri: string): Promise<Float32Array> {
  // ── 1. Resize & encode to JPEG ───────────────────────────────────
  const resized = await manipulateAsync(
    uri,
    [{ resize: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE } }],
    { compress: 0.9, format: SaveFormat.JPEG, base64: true },
  );

  if (!resized.base64) {
    throw new Error(
      '[preprocess] Image manipulation returned no base64 data. ' +
        'Ensure the source URI is valid and the device has enough storage.',
    );
  }

  // ── 2. Base64 → raw JPEG bytes ───────────────────────────────────
  const jpegBytes = decodeBase64(resized.base64);

  // ── 3. Decode JPEG to raw pixel data ──────────────────────────────
  let rawImageData;
  try {
    rawImageData = jpeg.decode(jpegBytes, { useTArray: true });
  } catch (decodeError: unknown) {
    const msg = decodeError instanceof Error ? decodeError.message : String(decodeError);
    throw new Error(`[preprocess] Failed to decode JPEG bytes: ${msg}`);
  }

  // ── 4. Extract & Normalise RGB channels to [-1, 1] ───────────────
  const tensor = new Float32Array(MODEL_INPUT_LENGTH);
  const data = rawImageData.data; // Uint8Array containing RGBA pixels (width * height * 4)

  for (let i = 0; i < MODEL_INPUT_SIZE * MODEL_INPUT_SIZE; i++) {
    // jpeg-js outputs RGBA layout. We map it to the model's expected RGB layout.
    tensor[i * 3]     = (data[i * 4]     / 127.5) - 1.0; // Red channel
    tensor[i * 3 + 1] = (data[i * 4 + 1] / 127.5) - 1.0; // Green channel
    tensor[i * 3 + 2] = (data[i * 4 + 2] / 127.5) - 1.0; // Blue channel
  }

  return tensor;
}

// ── Internal helpers ───────────────────────────────────────────────────

/**
 * Decode a base64-encoded string into a `Uint8Array`.
 *
 * Uses the global `atob` function (available in React Native's JSC /
 * Hermes environment) and `charCodeAt` for byte extraction.
 */
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
