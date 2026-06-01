/* eslint-disable no-console */
/**
 * @module ml/postprocess
 * @description Post-processing utilities for plant classification inference.
 *
 * Converts raw model output (logits) into human-readable predictions by
 * applying a numerically-stable softmax and extracting the top-K
 * highest-confidence species.
 */

import labels from './labels.json';
import type { Prediction } from '../types/observation';

// ── Constants ──────────────────────────────────────────────────────────

/** Default number of top predictions to return. */
const DEFAULT_TOP_K = 3;

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Compute a **numerically stable softmax** over raw logit scores.
 *
 * Subtracts `max(scores)` before exponentiation to prevent `Inf` /
 * `NaN` from large positive logits.
 *
 * @param scores - Raw logits from the model (Float32Array of any length).
 * @returns An array of probabilities that sum to 1.0.
 *
 * @example
 * ```ts
 * const probs = softmax(rawScores);
 * console.log(probs.reduce((a, b) => a + b, 0)); // ≈ 1.0
 * ```
 */
export function softmax(scores: Float32Array): number[] {
  // 1. Find the maximum logit for numerical stability.
  let max = -Infinity;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i]! > max) max = scores[i]!;
  }

  // 2. Exponentiate shifted logits and accumulate the denominator.
  const exps = new Array<number>(scores.length);
  let sum = 0;
  for (let i = 0; i < scores.length; i++) {
    const e = Math.exp(scores[i]! - max);
    exps[i] = e;
    sum += e;
  }

  // 3. Normalise.
  for (let i = 0; i < exps.length; i++) {
    exps[i]! /= sum;
  }

  return exps;
}

/**
 * Extract the **top-K** predictions from raw model output.
 *
 * Internally applies {@link softmax} to convert logits to probabilities,
 * then returns the `k` species with the highest confidence, sorted in
 * descending order.
 *
 * @param scores - Raw logit array from inference (length = NUM_CLASSES).
 * @param k      - How many top predictions to return (default: 3).
 * @returns An array of {@link Prediction} objects, sorted by confidence
 *          (highest first), each annotated with a 1-based rank.
 *
 * @example
 * ```ts
 * const preds = getTopK(rawScores, 5);
 * preds.forEach(p =>
 *   console.log(`#${p.rank} ${p.species}: ${(p.confidence * 100).toFixed(1)}%`),
 * );
 * ```
 */
export function getTopK(scores: Float32Array, k: number = DEFAULT_TOP_K): Prediction[] {
  // Always use softmax to get probabilities from raw dequantized logits.
  const probabilities = softmax(scores);

  let maxProb = 0;
  for (let i = 0; i < probabilities.length; i++) {
    if (probabilities[i]! > maxProb) maxProb = probabilities[i]!;
  }

  console.log(`[postprocess] Applied softmax to scores. Max probability: ${maxProb.toFixed(4)}`);

  // Build an index array so we can sort without losing original indices.
  const indices = Array.from({ length: probabilities.length }, (_, i) => i);

  // Partial sort: we only need the top-k, but a full sort is fine for
  // 1 081 elements (< 0.1 ms on modern devices).
  indices.sort((a, b) => probabilities[b]! - probabilities[a]!);

  const topK = indices.slice(0, k);

  return topK.map((classIndex, rank) => ({
    species: (labels as string[])[classIndex] ?? `Unknown (${classIndex})`,
    confidence: probabilities[classIndex]!,
    rank: rank + 1,
  }));
}

/**
 * Aggregate predictions across multiple images using ensemble averaging.
 * Computes softmax probabilities for each image individually, averages them,
 * and extracts the top-K species.
 */
export function getAggregatedTopK(
  scoresArray: Float32Array[],
  k: number = DEFAULT_TOP_K,
): Prediction[] {
  if (scoresArray.length === 0) return [];
  if (scoresArray.length === 1) return getTopK(scoresArray[0]!, k);

  const numClasses = scoresArray[0]!.length;
  const aggregatedProbabilities = new Float32Array(numClasses);

  // Compute softmax probabilities for each image and sum them up
  for (const scores of scoresArray) {
    const probs = softmax(scores);
    for (let i = 0; i < numClasses; i++) {
      aggregatedProbabilities[i] += probs[i]!;
    }
  }

  // Average the probabilities
  for (let i = 0; i < numClasses; i++) {
    aggregatedProbabilities[i] /= scoresArray.length;
  }

  let maxProb = 0;
  for (let i = 0; i < aggregatedProbabilities.length; i++) {
    if (aggregatedProbabilities[i]! > maxProb) maxProb = aggregatedProbabilities[i]!;
  }

  if (__DEV__) {
    console.log(
      `[postprocess] Aggregated predictions across ${scoresArray.length} images. Max avg probability: ${maxProb.toFixed(4)}`,
    );
  }

  const indices = Array.from({ length: numClasses }, (_, i) => i);
  indices.sort((a, b) => aggregatedProbabilities[b]! - aggregatedProbabilities[a]!);

  const topK = indices.slice(0, k);

  return topK.map((classIndex, rank) => ({
    species: (labels as string[])[classIndex] ?? `Unknown (${classIndex})`,
    confidence: aggregatedProbabilities[classIndex]!,
    rank: rank + 1,
  }));
}
