/**
 * @file Core data types for BioLens observations.
 *
 * Shared between the store, screens, components, and ML pipeline.
 */

/** A single species prediction from the ML model. */
export interface Prediction {
  /** Scientific or common name of the predicted species. */
  species: string;
  /** Model confidence score in [0, 1]. */
  confidence: number;
  /** Rank among top-K results (1 = best match). */
  rank: number;
}

/** A saved plant observation with images, predictions, and metadata. */
export interface Observation {
  /** Unique identifier (UUID v4). */
  id: string;
  /** ISO-8601 timestamp of when the observation was created. */
  timestamp: string;
  /** GPS coordinates at capture time, or null if unavailable. */
  location: { lat: number; lng: number; accuracy: number } | null;
  /** File URIs of captured images. */
  images: string[];
  /** Top-K predictions from the ML model. */
  predictions: Prediction[];
  /** Whether the user confirmed the identification. */
  confirmed: boolean;
  /** Whether this observation has been synced to a remote backend. */
  synced: boolean;
  /** Optional user-specified site / location name (e.g. 'NMIMS Campus'). */
  siteName?: string;
}
