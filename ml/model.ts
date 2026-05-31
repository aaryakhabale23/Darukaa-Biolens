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

// Verified output class count from trained model signature
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

  const inputTensorDesc = model.inputs[0];
  const outputTensorDesc = model.outputs[0];

  console.log('[model] Inputs info:', JSON.stringify(model.inputs));
  console.log('[model] Outputs info:', JSON.stringify(model.outputs));

  const inputDataType = inputTensorDesc?.dataType ?? 'int8';
  const outputDataType = outputTensorDesc?.dataType ?? 'int8';

  let inputTypedArray: Uint8Array | Int8Array | Float32Array;

  // 1. Handle Input Quantization if needed
  if (inputDataType === 'uint8') {
    console.log('[model] Input is uint8, quantizing float32 [-1, 1] -> uint8 [0, 255]');
    const uint8Arr = new Uint8Array(tensor.length);
    for (let i = 0; i < tensor.length; i++) {
      uint8Arr[i] = Math.max(0, Math.min(255, Math.round((tensor[i]! + 1.0) * 127.5)));
    }
    inputTypedArray = uint8Arr;
  } else if (inputDataType === 'int8') {
    console.log('[model] Input is int8, quantizing float32 [-1, 1] -> int8 [-128, 127]');
    const scale = (inputTensorDesc as any)?.scale ?? 0.007843135;
    const zeroPoint = (inputTensorDesc as any)?.zeroPoint ?? -1;
    const int8Arr = new Int8Array(tensor.length);
    for (let i = 0; i < tensor.length; i++) {
      int8Arr[i] = Math.max(-128, Math.min(127, Math.round(tensor[i]! / scale + zeroPoint)));
    }
    inputTypedArray = int8Arr;
  } else {
    // Default to float32
    inputTypedArray = tensor;
  }

  // 2. Run Inference
  // Slice the buffer to guarantee we pass only the active content bytes to TFLite.
  const inputBuffer = inputTypedArray.buffer.slice(
    inputTypedArray.byteOffset,
    inputTypedArray.byteOffset + inputTypedArray.byteLength,
  ) as ArrayBuffer;
  const outputBuffers: ArrayBuffer[] = await model.run([inputBuffer]);

  if (!outputBuffers.length || !outputBuffers[0]) {
    throw new Error(
      '[model] Inference returned no output buffers. ' +
        'This usually indicates a model / delegate mismatch.',
    );
  }

  const outBuffer = outputBuffers[0];
  console.log(`[model] Output buffer byteLength: ${outBuffer.byteLength}`);

  // 3. Handle Output Dequantization if needed
  let scores: Float32Array;

  if (outputDataType === 'uint8') {
    const uint8Arr = new Uint8Array(outBuffer);
    console.log(
      '[model] Output is uint8. First 10 raw scores:',
      JSON.stringify(Array.from(uint8Arr.slice(0, 10))),
    );
    scores = new Float32Array(uint8Arr.length);
    // Dequantize from [0, 255] back to [0.0, 1.0] probabilities using the model's scale.
    // (scale = 0.00390625 = 1/256)
    for (let i = 0; i < uint8Arr.length; i++) {
      scores[i] = uint8Arr[i]! * 0.00390625;
    }
  } else if (outputDataType === 'int8') {
    const int8Arr = new Int8Array(outBuffer);
    console.log(
      '[model] Output is int8. First 10 raw scores:',
      JSON.stringify(Array.from(int8Arr.slice(0, 10))),
    );
    scores = new Float32Array(int8Arr.length);
    const scale = (outputTensorDesc as any)?.scale ?? 0.16345862;
    const zeroPoint = (outputTensorDesc as any)?.zeroPoint ?? 127;
    for (let i = 0; i < int8Arr.length; i++) {
      scores[i] = (int8Arr[i]! - zeroPoint) * scale;
    }
  } else {
    // Default: output is float32
    if (outBuffer.byteLength % 4 !== 0) {
      throw new Error(
        `[model] Output buffer byteLength (${outBuffer.byteLength}) is not divisible by 4 ` +
          `for float32 datatype. Model outputs desc: ${JSON.stringify(model.outputs)}`,
      );
    }
    scores = new Float32Array(outBuffer);
    console.log(
      '[model] Output is float32. First 10 scores:',
      JSON.stringify(Array.from(scores.slice(0, 10))),
    );
  }

  return scores;
}
