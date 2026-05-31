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
  /** Clear all observations and generate 55 diverse mock field observations for testing. */
  generateMockData: () => void;
  /** Filter out all mock observations from memory and AsyncStorage. */
  clearMockObservations: () => void;
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
      // Sort updated chronologically by timestamp (newest first)
      updated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
        // Sort parsed chronologically by timestamp (newest first)
        parsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        set({ observations: parsed });
      }
    } catch (error) {
      console.error('[observationStore] Failed to load observations:', error);
    }
  },

  persistObservations: async () => {
    await persistToStorage(get().observations);
  },

  generateMockData: () => {
    const mockSpecies = [
      'Mangifera indica',
      'Azadirachta indica',
      'Ocimum tenuiflorum',
      'Ficus religiosa',
      'Rosa indica',
      'Catharanthus roseus',
      'Aloe vera',
      'Bambusa vulgaris',
    ];
    const mockSites = [
      { name: 'NMIMS Campus', lat: 19.1103, lng: 72.8477 },
      { name: 'Sanjay Gandhi National Park', lat: 19.2288, lng: 72.9182 },
      { name: 'Juhu Beach Area', lat: 19.1062, lng: 72.8258 },
    ];

    const generated: Observation[] = [];
    const now = new Date();

    for (let i = 0; i < 55; i++) {
      const site = mockSites[i % mockSites.length]!;
      const speciesIndex = (i * 3 + (i % 2)) % mockSpecies.length;
      const primarySpecies = mockSpecies[speciesIndex]!;
      const secondarySpecies = mockSpecies[(speciesIndex + 1) % mockSpecies.length]!;
      const tertiarySpecies = mockSpecies[(speciesIndex + 2) % mockSpecies.length]!;

      // Jitter coordinates slightly
      const latJitter = (Math.random() - 0.5) * 0.006;
      const lngJitter = (Math.random() - 0.5) * 0.006;

      const dayOffset = Math.floor(Math.random() * 30);
      const timestamp = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000).toISOString();

      const conf1 = 0.5 + Math.random() * 0.45;
      const conf2 = Math.random() * (1 - conf1);
      const conf3 = 1 - conf1 - conf2;

      generated.push({
        id: `mock-${i}-${Math.random().toString(36).substring(2, 11)}`,
        timestamp,
        location: {
          lat: site.lat + latJitter,
          lng: site.lng + lngJitter,
          accuracy: 5 + Math.random() * 15,
        },
        images: [], // No mock image
        predictions: [
          { species: primarySpecies, confidence: conf1, rank: 1 },
          { species: secondarySpecies, confidence: conf2, rank: 2 },
          { species: tertiarySpecies, confidence: conf3, rank: 3 },
        ],
        confirmed: Math.random() > 0.15, // 85% confirmed
        synced: false,
        siteName: site.name,
      });
    }

    set((state) => {
      const updated = [...generated, ...state.observations];
      // Sort updated chronologically by timestamp (newest first)
      updated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      void persistToStorage(updated);
      return { observations: updated };
    });
  },

  clearMockObservations: () => {
    set((state) => {
      const filtered = state.observations.filter((obs) => !obs.id.startsWith('mock-'));
      void persistToStorage(filtered);
      return { observations: filtered };
    });
  },
}));
