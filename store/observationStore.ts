/**
 * @file Observation store — Zustand v5 state management for BioLens observations.
 *
 * Handles the full lifecycle of plant observations: capturing images,
 * saving predictions, confirming/rejecting identifications, and
 * persisting everything to AsyncStorage so data survives app restarts.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage key ────────────────────────────────────────────────────────────
import { Observation, Prediction } from '../types/observation';

// Re-export them so other files can continue importing them from here if needed
export { Observation, Prediction };

// ─── Storage key ────────────────────────────────────────────────────────────
const STORAGE_KEY = 'biolens_observations';

// ─── Constants ──────────────────────────────────────────────────────────────
/** Maximum number of images allowed per capture session. */
const MAX_IMAGES_PER_SESSION = 5;

// ─── Store shape ────────────────────────────────────────────────────────────

/** Shape of the observation Zustand store (state + actions). */
interface ObservationState {
  /** All persisted observations, newest first. */
  observations: Observation[];
  /** Images captured in the current (unsaved) session. */
  currentImages: string[];

  // ── Actions ─────────────────────────────────────────────────────────────

  /** Append an image URI to the current session (max {@link MAX_IMAGES_PER_SESSION}). */
  addImage: (uri: string) => void;
  /** Remove an image URI from the current session by index. */
  removeImage: (index: number) => void;
  /** Discard all images from the current capture session. */
  clearCurrentImages: () => void;
  /** Create and persist a new observation (id, timestamp & synced are auto-set). */
  saveObservation: (observation: Omit<Observation, 'id' | 'timestamp' | 'synced'>) => void;
  /** Alias for {@link saveObservation} to maintain compatibility. */
  addObservation: (observation: Omit<Observation, 'id' | 'timestamp' | 'synced'>) => void;
  /** Mark an observation as confirmed by the user. */
  confirmObservation: (id: string) => void;
  /** Remove an observation (user rejected the identification). */
  rejectObservation: (id: string) => void;
  /** Return a snapshot of all observations. */
  getAllObservations: () => Observation[];
  /** Hydrate the store from AsyncStorage (call once on app start). */
  loadObservations: () => Promise<void>;
  /** Manually flush the current observations array to AsyncStorage. */
  persistObservations: () => Promise<void>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generate a UUID v4 string.
 *
 * Uses `crypto.randomUUID()` when available (Hermes ≥ 0.72) and falls back
 * to a Math.random-based implementation for older engines.
 */
function generateId(): string {
  // Prefer the native implementation when the runtime exposes it.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback: RFC 4122 §4.4 compliant v4 UUID via Math.random.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

/**
 * Persist an observations array to AsyncStorage.
 *
 * Serialises the array as JSON. Errors are logged but never thrown so
 * that a storage failure doesn't crash the app.
 */
async function persistToStorage(observations: Observation[]): Promise<void> {
  try {
    const json = JSON.stringify(observations);
    await AsyncStorage.setItem(STORAGE_KEY, json);
  } catch (error) {
    console.error('[observationStore] Failed to persist observations:', error);
  }
}

// ─── Store ──────────────────────────────────────────────────────────────────

/**
 * Primary Zustand store for observation state.
 *
 * @example
 * ```tsx
 * const observations = useObservationStore((s) => s.observations);
 * const save = useObservationStore((s) => s.saveObservation);
 * ```
 */
export const useObservationStore = create<ObservationState>((set, get) => ({
  // ── State ───────────────────────────────────────────────────────────────
  observations: [],
  currentImages: [],

  // ── Image session ───────────────────────────────────────────────────────

  addImage: (uri: string) => {
    set((state) => {
      if (state.currentImages.length >= MAX_IMAGES_PER_SESSION) {
        console.warn(
          `[observationStore] Max images (${MAX_IMAGES_PER_SESSION}) reached — ignoring addImage.`,
        );
        return state; // No mutation → no re-render.
      }
      return { currentImages: [...state.currentImages, uri] };
    });
  },

  removeImage: (index: number) => {
    set((state) => ({
      currentImages: state.currentImages.filter((_, i) => i !== index),
    }));
  },

  clearCurrentImages: () => {
    set({ currentImages: [] });
  },

  // ── CRUD ────────────────────────────────────────────────────────────────

  saveObservation: (partial) => {
    const newObservation: Observation = {
      ...partial,
      id: generateId(),
      timestamp: new Date().toISOString(),
      synced: false,
    };

    set((state) => {
      const updated = [newObservation, ...state.observations];
      // Fire-and-forget persistence so the UI isn't blocked.
      void persistToStorage(updated);
      return { observations: updated };
    });
  },

  addObservation: (partial) => {
    get().saveObservation(partial);
  },

  confirmObservation: (id: string) => {
    set((state) => {
      const updated = state.observations.map((obs) =>
        obs.id === id ? { ...obs, confirmed: true } : obs,
      );
      void persistToStorage(updated);
      return { observations: updated };
    });
  },

  rejectObservation: (id: string) => {
    set((state) => {
      const updated = state.observations.filter((obs) => obs.id !== id);
      void persistToStorage(updated);
      return { observations: updated };
    });
  },

  getAllObservations: () => get().observations,

  // ── Persistence ─────────────────────────────────────────────────────────

  loadObservations: async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) {
        const parsed: Observation[] = JSON.parse(json);
        set({ observations: parsed });
      }
    } catch (error) {
      console.error('[observationStore] Failed to load observations:', error);
    }
  },

  persistObservations: async () => {
    await persistToStorage(get().observations);
  },
}));
