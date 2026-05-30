/**
 * @file Results screen — displays ML predictions and lets the user
 * confirm or reject the identification.
 *
 * Route params (JSON-encoded strings):
 * - `predictions` — Prediction[] from the ML pipeline
 * - `location`    — { lat, lng, accuracy } | null
 *
 * The user sees:
 * 1. A non-removable ImageStrip of captured photos at the top.
 * 2. Three PredictionCard components (top-K results).
 * 3. "Confirm ✓" (green) and "Reject ✗" (coral) action buttons.
 *
 * Both actions save the observation to the Zustand store (with the
 * appropriate `confirmed` flag), clear `currentImages`, and navigate
 * back to the camera screen.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import PredictionCard from '../components/PredictionCard';
import ImageStrip from '../components/ImageStrip';
import { useObservationStore } from '../store/observationStore';
import type { Prediction } from '../types/observation';

// ─── Color Palette ──────────────────────────────────────────────────────────
const COLORS = {
  primaryGreen: '#2D6A4F',
  secondaryGreen: '#52B788',
  accent: '#95D5B2',
  background: '#F0F7F4',
  darkText: '#1B4332',
  white: '#FFFFFF',
  coral: '#E76F51',
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * ResultsScreen — displays the identification results for a captured plant.
 */
export default function ResultsScreen(): React.JSX.Element {
  // ── Route params ───────────────────────────────────────────────────────
  const params = useLocalSearchParams<{
    predictions: string;
    location: string;
  }>();

  const predictions: Prediction[] = useMemo(() => {
    try {
      return JSON.parse(params.predictions ?? '[]') as Prediction[];
    } catch {
      console.error('[ResultsScreen] Failed to parse predictions param.');
      return [];
    }
  }, [params.predictions]);

  const location = useMemo(() => {
    try {
      return JSON.parse(params.location ?? 'null') as {
        lat: number;
        lng: number;
        accuracy: number;
      } | null;
    } catch {
      return null;
    }
  }, [params.location]);

  // ── Store ──────────────────────────────────────────────────────────────
  const currentImages = useObservationStore((s) => s.currentImages);
  const addObservation = useObservationStore((s) => s.addObservation);
  const clearCurrentImages = useObservationStore((s) => s.clearCurrentImages);

  // ── Handlers ───────────────────────────────────────────────────────────

  /** Persist the observation and return to the camera. */
  const saveAndReturn = useCallback(
    async (confirmed: boolean) => {
      try {
        await addObservation({
          images: [...currentImages],
          predictions,
          location,
          confirmed,
        });
        clearCurrentImages();
        router.back();
      } catch (err) {
        console.error('[ResultsScreen] Save failed:', err);
        Alert.alert('Save error', 'Could not save the observation. Please try again.');
      }
    },
    [currentImages, predictions, location, addObservation, clearCurrentImages],
  );

  const handleConfirm = useCallback(() => saveAndReturn(true), [saveAndReturn]);
  const handleReject = useCallback(() => saveAndReturn(false), [saveAndReturn]);

  // ── Top prediction label ───────────────────────────────────────────────
  const topSpecies = predictions.length > 0 ? predictions[0].species : 'Unknown';
  const topConfidence =
    predictions.length > 0 ? `${(predictions[0].confidence * 100).toFixed(1)}%` : '';

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Captured images ──────────────────────────────────────── */}
        <View style={styles.imageSection}>
          <ImageStrip images={currentImages} removable={false} />
        </View>

        {/* ── Header ───────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Identification Results</Text>
          <Text style={styles.headerSubtitle}>
            Top match: <Text style={styles.highlightText}>{topSpecies}</Text>{' '}
            {topConfidence !== '' && <Text style={styles.confidenceLabel}>({topConfidence})</Text>}
          </Text>
        </View>

        {/* ── Prediction cards ─────────────────────────────────────── */}
        <View style={styles.cardContainer}>
          {predictions.length > 0 ? (
            predictions.map((pred) => (
              <PredictionCard
                key={`pred-${pred.rank}`}
                prediction={pred}
                isTopResult={pred.rank === 1}
              />
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No predictions available.</Text>
            </View>
          )}
        </View>

        {/* ── Location info ─────────────────────────────────────────── */}
        {location && (
          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>📍 Location</Text>
            <Text style={styles.locationValue}>
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </Text>
            <Text style={styles.locationAccuracy}>± {location.accuracy.toFixed(0)} m</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Action buttons ───────────────────────────────────────────── */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.rejectButton} onPress={handleReject} activeOpacity={0.8}>
          <Text style={styles.actionButtonText}>Reject ✗</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm} activeOpacity={0.8}>
          <Text style={styles.actionButtonText}>Confirm ✓</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // ── Image section ────────────────────────────────────────────────────
  imageSection: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },

  // ── Header ───────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.darkText,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 15,
    color: COLORS.darkText,
    lineHeight: 22,
  },
  highlightText: {
    fontWeight: '700',
    fontStyle: 'italic',
    color: COLORS.primaryGreen,
  },
  confidenceLabel: {
    fontWeight: '500',
    color: COLORS.secondaryGreen,
  },

  // ── Cards ────────────────────────────────────────────────────────────
  cardContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyCardText: {
    color: COLORS.darkText,
    fontSize: 15,
  },

  // ── Location ─────────────────────────────────────────────────────────
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkText,
  },
  locationValue: {
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    color: COLORS.darkText,
    flex: 1,
  },
  locationAccuracy: {
    fontSize: 12,
    color: '#888',
  },

  // ── Action bar ───────────────────────────────────────────────────────
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: COLORS.coral,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: COLORS.primaryGreen,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
});
