/**
 * @module ml/postprocess
 * @description Post-processing utilities for plant classification inference.
 *
 * Converts raw model output (logits) into human-readable predictions by
 * applying a numerically-stable softmax and extracting the top-K
 * highest-confidence species.
 */

import labels from './labels.json';

// ── Types ──────────────────────────────────────────────────────────────

/** A single species prediction with its confidence score and rank. */
export interface Prediction {
  /** Botanical species name (e.g. "Mangifera indica"). */
  species: string;
  /** Probability in the range [0, 1] after softmax. */
  confidence: number;
  /** 1-based rank (1 = most likely). */
  rank: number;
}

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
  // Check if scores already represent a normalized probability distribution (sums to ~1.0)
  let sumOfRawScores = 0;
  for (let i = 0; i < scores.length; i++) {
    sumOfRawScores += scores[i]!;
  }

  // If the sum is very close to 1.0, these are already probabilities (e.g. from quantized softmax outputs).
  // Running softmax again would flatten/dilute them.
  const probabilities = Math.abs(sumOfRawScores - 1.0) < 0.05
    ? Array.from(scores)
    : softmax(scores);

  // Build an index array so we can sort without losing original indices.
  const indices = Array.from({ length: probabilities.length }, (_, i) => i);

  // Sort by probability descending
  indices.sort((a, b) => probabilities[b]! - probabilities[a]!);

  const topK = indices.slice(0, k);

  return topK.map((classIndex, rank) => ({
    species: (labels as string[])[classIndex] ?? `Unknown (${classIndex})`,
    confidence: probabilities[classIndex]!,
    rank: rank + 1,
  }));
}
