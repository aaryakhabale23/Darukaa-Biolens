/* eslint-disable no-console */
/**
 * @module ml/model
 * @description TFLite model loading and inference for plant identification.
 *
 * Uses a **singleton pattern** so the heavy `.tflite` asset is loaded only
 * once during the app's lifetime. Subsequent calls to {@link loadModel}
 * return the same `TfliteModel` instance.
 */

import { loadTensorflowModel, type TfliteModel } from 'react-native-fast-tflite';
import { Asset } from 'expo-asset';
// Re-export the model type for convenience.
export type { TfliteModel };

// Verified output class count from trained model signature
export const NUM_CLASSES = 1081;

// ── Types ──────────────────────────────────────────────────────────────

export interface QuantizedTensorDesc {
  dataType: 'uint8' | 'int8' | 'float32' | string;
  name?: string;
  scale?: number;
  zeroPoint?: number;
}

// ── Singleton state ────────────────────────────────────────────────────

/** Cached model instance — `null` until first successful load. */
let cachedModel: TfliteModel | null = null;

/** In-flight load promise used to prevent duplicate parallel loads. */
let loadingPromise: Promise<TfliteModel> | null = null;

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Load the MobileNet-v2 plant classification model from the bundled
 * `.tflite` asset.
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

      const asset = Asset.fromModule(
        require('../assets/models/mobilenet_v2_plant_quant.tflite')
      );

      await asset.downloadAsync();

      if (!asset.localUri) {
        throw new Error('Failed to resolve model asset');
      }

      const model = await loadTensorflowModel(
        { url: asset.localUri },
        []
      );
      /* eslint-enable @typescript-eslint/no-require-imports */
      cachedModel = model;
      return model;
    } catch (e) {
      console.error('Model load failed:', e);
      loadingPromise = null;
      throw e;
    }
  })();

  return loadingPromise;
}

/**
 * Run inference on a pre-processed input tensor.
 *
 * Expects a `Float32Array` of shape `[1, 224, 224, 3]` (150 528 floats)
 * with values normalised to `[-1, 1]`.
 */
export async function runInference(tensor: Float32Array): Promise<Float32Array> {
  const model = await loadModel();

  const inputTensorDesc = model.inputs[0] as QuantizedTensorDesc | undefined;
  const outputTensorDesc = model.outputs[0] as QuantizedTensorDesc | undefined;

  if (__DEV__) {
    console.log('[model] Inputs info:', JSON.stringify(model.inputs));
    console.log('[model] Outputs info:', JSON.stringify(model.outputs));
  }

  const inputDataType = inputTensorDesc?.dataType ?? 'int8';
  const outputDataType = outputTensorDesc?.dataType ?? 'int8';

  let inputTypedArray: Uint8Array | Int8Array | Float32Array;

  // 1. Handle Input Quantization if needed
  if (inputDataType === 'uint8') {
    if (__DEV__) {
      console.log('[model] Input is uint8, quantizing float32 [-1, 1] -> uint8 [0, 255]');
    }
    const uint8Arr = new Uint8Array(tensor.length);
    for (let i = 0; i < tensor.length; i++) {
      uint8Arr[i] = Math.max(0, Math.min(255, Math.round((tensor[i]! + 1.0) * 127.5)));
    }
    inputTypedArray = uint8Arr;
  } else if (inputDataType === 'int8') {
    if (__DEV__) {
      console.log('[model] Input is int8, quantizing float32 [-1, 1] -> int8 [-128, 127]');
    }
    const scale = inputTensorDesc?.scale ?? 0.007843135;
    const zeroPoint = inputTensorDesc?.zeroPoint ?? -1;
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
  if (__DEV__) {
    console.log(`[model] Output buffer byteLength: ${outBuffer.byteLength}`);
  }

  // 3. Handle Output Dequantization if needed
  let scores: Float32Array;

  if (outputDataType === 'uint8') {
    const uint8Arr = new Uint8Array(outBuffer);
    if (__DEV__) {
      console.log(
        '[model] Output is uint8. First 10 raw scores:',
        JSON.stringify(Array.from(uint8Arr.slice(0, 10))),
      );
    }
    scores = new Float32Array(uint8Arr.length);
    // Dequantize from [0, 255] back to [0.0, 1.0] probabilities using the model's scale.
    // (scale = 0.00390625 = 1/256)
    for (let i = 0; i < uint8Arr.length; i++) {
      scores[i] = uint8Arr[i]! * 0.00390625;
    }
  } else if (outputDataType === 'int8') {
    const int8Arr = new Int8Array(outBuffer);
    if (__DEV__) {
      console.log(
        '[model] Output is int8. First 10 raw scores:',
        JSON.stringify(Array.from(int8Arr.slice(0, 10))),
      );
    }
    scores = new Float32Array(int8Arr.length);
    const scale = outputTensorDesc?.scale ?? 0.16345862;
    const zeroPoint = outputTensorDesc?.zeroPoint ?? 127;
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
    if (__DEV__) {
      console.log(
        '[model] Output is float32. First 10 scores:',
        JSON.stringify(Array.from(scores.slice(0, 10))),
      );
    }
  }

  return scores;
}
