/**
 * @module ml/model
 * @description TFLite model loading and inference for plant identification.
 *
 * Uses a **singleton pattern** so the heavy `.tflite` asset is loaded only
 * once during the app's lifetime. Subsequent calls to {@link loadModel}
 * return the same `TfliteModel` instance.
 */

import { loadTensorflowModel, type TfliteModel } from 'react-native-fast-tflite';

// Re-export the model type for convenience.
export type { TfliteModel };

// ── Constants ──────────────────────────────────────────────────────────

/**
 * Number of classes the model predicts (plant species).
 * This must match the length of `labels.json`.
 */
export const NUM_CLASSES = 1081;

// ── Singleton state ────────────────────────────────────────────────────

/** Cached model instance — `null` until first successful load. */
let cachedModel: TfliteModel | null = null;

/** In-flight load promise used to prevent duplicate parallel loads. */
let loadingPromise: Promise<TfliteModel> | null = null;

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Load the MobileNet-v2 plant classification model from the bundled
 * `.tflite` asset.
 *
 * The model is loaded **once** and cached in-memory; subsequent calls
 * return the same instance immediately. If a load is already in
 * progress (e.g. triggered from two React components mounting at the
 * same time), both callers await the same promise.
 *
 * @returns The loaded `TfliteModel` ready for inference.
 *
 * @throws {Error} If the asset cannot be found or the native TFLite
 *                 runtime fails to initialise the model.
 *
 * @example
 * ```ts
 * const model = await loadModel();
 * console.log('Input tensors:', model.inputs);
 * ```
 */
export async function loadModel(): Promise<TfliteModel> {
  // Fast path — model is already loaded.
  if (cachedModel !== null) {
    return cachedModel;
  }

  // If another caller already kicked off a load, piggy-back on it.
  if (loadingPromise !== null) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const model = await loadTensorflowModel(
        // The `require()` call is resolved at bundle-time by Metro.
        // Make sure `tflite` is listed as an `assetExts` in metro.config.js.
        require('../assets/models/mobilenet_v2_plant.tflite') as number,
        [], // Use the default CPU delegate.
      );
      /* eslint-enable @typescript-eslint/no-require-imports */

      cachedModel = model;
      return model;
    } catch (error: unknown) {
      // Reset so a future call can retry after a transient failure.
      loadingPromise = null;

      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `[model] Failed to load TFLite model: ${message}. ` +
          'Ensure the .tflite file exists in assets/models/ and that ' +
          '"tflite" is registered as an asset extension in metro.config.js.',
      );
    }
  })();

  return loadingPromise;
}

/**
 * Run inference on a pre-processed input tensor.
 *
 * Expects a `Float32Array` of shape `[1, 224, 224, 3]` (150 528 floats)
 * with values normalised to `[-1, 1]`.
 *
 * @param tensor - The preprocessed image tensor (from {@link preprocessImage}).
 * @returns A `Float32Array` of length {@link NUM_CLASSES} (1 081) containing
 *          raw logits / class scores for each plant species.
 *
 * @throws {Error} If the model has not been loaded yet, or if inference
 *                 fails at the native level.
 *
 * @example
 * ```ts
 * const scores = await runInference(tensor);
 * const predictions = getTopK(scores);
 * ```
 */
export async function runInference(tensor: Float32Array): Promise<Float32Array> {
  const model = await loadModel();

  // 1. Resolve input dataType and convert input tensor accordingly
  const inputTensorInfo = model.inputs[0];
  let inputBuffer: ArrayBuffer;

  if (inputTensorInfo && inputTensorInfo.dataType === 'uint8') {
    // Convert float [-1, 1] back to u8 [0, 255]
    const u8Array = new Uint8Array(tensor.length);
    for (let i = 0; i < tensor.length; i++) {
      // Float range [-1, 1] maps to [0, 255]
      u8Array[i] = Math.round((tensor[i] + 1.0) * 127.5);
    }
    inputBuffer = u8Array.buffer as ArrayBuffer;
  } else {
    inputBuffer = tensor.buffer as ArrayBuffer;
  }

  // 2. Execute TFLite model inference
  const outputBuffers: ArrayBuffer[] = await model.run([inputBuffer]);

  if (!outputBuffers.length) {
    throw new Error(
      '[model] Inference returned no output buffers. ' +
        'This usually indicates a model / delegate mismatch.',
    );
  }

  // 3. Resolve output dataType and return Float32 scores
  const outputTensorInfo = model.outputs[0];
  if (outputTensorInfo && outputTensorInfo.dataType === 'uint8') {
    // Read the buffer as bytes and scale to [0, 1] floats
    const u8Output = new Uint8Array(outputBuffers[0]!);
    const f32Output = new Float32Array(u8Output.length);
    for (let i = 0; i < u8Output.length; i++) {
      f32Output[i] = u8Output[i] / 255.0;
    }
    return f32Output;
  } else {
    // Standard float32 output
    return new Float32Array(outputBuffers[0]!);
  }
}
