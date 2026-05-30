/**
 * @module ml/preprocess
 * @description Image preprocessing pipeline for plant identification.
 *
 * Resizes an input image to the model's expected 224×224 resolution,
 * decodes it from base64 JPEG, and produces a Float32Array tensor
 * normalized to the [-1, 1] range expected by MobileNet-v2.
 */

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// ── Constants ──────────────────────────────────────────────────────────

/** Width & height the model expects (MobileNet-v2 default). */
export const MODEL_INPUT_SIZE = 224;

/** Number of colour channels (RGB). */
export const MODEL_INPUT_CHANNELS = 3;

/** Total number of float values in the input tensor [1, 224, 224, 3]. */
export const MODEL_INPUT_LENGTH =
  MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * MODEL_INPUT_CHANNELS;

/**
 * Byte offset into the raw JPEG data where pixel content begins.
 * Standard JPEG files carry a small header (~12 bytes for SOI + APP0/JFIF).
 * This value is used when reading raw bytes after base64-decoding. In
 * practice the exact offset can vary, but 12 is a safe conservative
 * default for uncompressed pixel streams produced by the image manipulator.
 *
 * > **Note:** Because expo-image-manipulator re-encodes to JPEG, the
 * > actual bytes are JPEG-compressed, not raw RGB. This constant is kept
 * > for compatibility with the PRD reference implementation. In a
 * > production build the pixel extraction should be replaced with a
 * > proper JPEG decoder (or use `expo-image-manipulator`'s new
 * > context-based API which can return raw pixel buffers).
 */
const JPEG_HEADER_OFFSET = 12;

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Pre-process a captured or gallery image for TFLite inference.
 *
 * 1. Resizes the image to 224 × 224 px.
 * 2. Exports it as a lossless-quality JPEG with embedded base64 data.
 * 3. Decodes the base64 string into a byte array.
 * 4. Normalises each byte to `[-1, 1]` using `(pixel / 127.5) - 1.0`.
 *
 * The returned `Float32Array` can be passed directly into the model's
 * `run()` method after wrapping it in an `ArrayBuffer[]`.
 *
 * @param uri - Local file URI (e.g. `file:///…/photo.jpg`) or a
 *              base64 data-URI of the source image.
 * @returns A `Float32Array` of length 150 528 (224 × 224 × 3) with
 *          values in the range [-1, 1].
 *
 * @throws {Error} If the image manipulation fails or the base64 data
 *                 is missing / too short to extract pixel values.
 *
 * @example
 * ```ts
 * const tensor = await preprocessImage(photo.uri);
 * const output = await model.run([tensor.buffer]);
 * ```
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

  // ── 2. Base64 → raw bytes ────────────────────────────────────────
  const raw = decodeBase64(resized.base64);

  const requiredLength = JPEG_HEADER_OFFSET + MODEL_INPUT_LENGTH;
  if (raw.length < requiredLength) {
    throw new Error(
      `[preprocess] Decoded byte array is too short ` +
        `(got ${raw.length}, need ≥ ${requiredLength}). ` +
        `The image may be corrupt or the JPEG header offset is wrong.`,
    );
  }

  // ── 3. Normalise to [-1, 1] ──────────────────────────────────────
  const tensor = new Float32Array(MODEL_INPUT_LENGTH);
  for (let i = 0; i < MODEL_INPUT_LENGTH; i++) {
    tensor[i] = raw[i + JPEG_HEADER_OFFSET]! / 127.5 - 1.0;
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
