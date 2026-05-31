/**
 * @file History screen — browse and export saved observations.
 *
 * Features:
 * - FlatList of observation cards with thumbnail, top prediction,
 *   timestamp, status badge, and GPS coordinates.
 * - Pull-to-refresh to reload observations from persistent storage.
 * - Empty state with a friendly prompt.
 * - Export button that serializes all observations to a JSON file.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';

import { useObservationStore } from '../store/observationStore';
import { exportObservationsPdf } from '../utils/exportPdf';
import type { Observation } from '../types/observation';

// ─── Color Palette ──────────────────────────────────────────────────────────
const COLORS = {
  primaryGreen: '#2D6A4F',
  secondaryGreen: '#52B788',
  accent: '#95D5B2',
  background: '#F0F7F4',
  darkText: '#1B4332',
  white: '#FFFFFF',
  coral: '#E76F51',
  lightBorder: '#D5E8DC',
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format an ISO-8601 timestamp into a human-friendly string.
 * Example: "30 May 2026, 5:42 PM"
 */
function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return (
      date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }) +
      ', ' +
      date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    );
  } catch {
    return iso;
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface ObservationCardProps {
  observation: Observation;
}

/** A single row in the history list. */
function ObservationCard({ observation }: ObservationCardProps): React.JSX.Element {
  const topPrediction = observation.predictions[0] ?? null;

  return (
    <View style={styles.card}>
      {/* Thumbnail */}
      {observation.images.length > 0 ? (
        <Image
          source={{ uri: observation.images[0] }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <Text style={styles.thumbnailPlaceholderText}>🌿</Text>
        </View>
      )}

      {/* Details */}
      <View style={styles.cardBody}>
        {/* Species + confidence */}
        <Text style={styles.speciesName} numberOfLines={1}>
          {topPrediction?.species ?? 'Unknown'}
        </Text>
        {topPrediction && (
          <Text style={styles.confidence}>
            {(topPrediction.confidence * 100).toFixed(1)}% confidence
          </Text>
        )}

        {/* Timestamp */}
        <Text style={styles.timestamp}>{formatTimestamp(observation.timestamp)}</Text>

        {/* GPS coordinates */}
        {observation.location && (
          <Text style={styles.coords}>
            📍 {observation.location.lat.toFixed(4)}, {observation.location.lng.toFixed(4)}
          </Text>
        )}
      </View>

      {/* Status badge */}
      <View
        style={[
          styles.statusBadge,
          observation.confirmed ? styles.statusConfirmed : styles.statusRejected,
        ]}
      >
        <Text style={styles.statusText}>
          {observation.confirmed ? 'Confirmed ✓' : 'Rejected ✗'}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

/**
 * HistoryScreen — scrollable list of all saved plant observations.
 */
export default function HistoryScreen(): React.JSX.Element {
  const observations = useObservationStore((s) => s.observations);
  const loadObservations = useObservationStore((s) => s.loadObservations);

  const [refreshing, setRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // ── Load on mount ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        await loadObservations();
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [loadObservations]);

  // ── Pull-to-refresh ────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadObservations();
    } finally {
      setRefreshing(false);
    }
  }, [loadObservations]);

  // ── Export ─────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (observations.length === 0) {
      Alert.alert('Nothing to export', 'Capture some plants first!');
      return;
    }

    setIsExporting(true);
    try {
      await exportObservationsPdf(observations);
    } catch (err) {
      console.error('[HistoryScreen] Export failed:', err);
      Alert.alert('Export error', 'Could not export observations PDF.');
    } finally {
      setIsExporting(false);
    }
  }, [observations]);

  // ── Renderers ─────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: Observation }) => <ObservationCard observation={item} />,
    [],
  );

  const keyExtractor = useCallback((item: Observation) => item.id, []);

  // ── Loading state ──────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={COLORS.primaryGreen} />
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ── Observation list ────────────────────────────────────────── */}
      <FlatList
        data={observations}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={
          observations.length === 0 ? styles.emptyListContent : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primaryGreen}
            colors={[COLORS.primaryGreen]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🌱</Text>
            <Text style={styles.emptyTitle}>No observations yet</Text>
            <Text style={styles.emptyBody}>
              Start by capturing some plants!{'\n'}Your identifications will appear here.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* ── Export bar ──────────────────────────────────────────────── */}
      {observations.length > 0 && (
        <View style={styles.exportBar}>
          <TouchableOpacity
            style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
            onPress={handleExport}
            disabled={isExporting}
            activeOpacity={0.8}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.exportButtonText}>Export PDF Report ({observations.length})</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const THUMB_SIZE = 60;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },

  // ── List ─────────────────────────────────────────────────────────────
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },

  // ── Card ─────────────────────────────────────────────────────────────
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    // subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  // ── Thumbnail ────────────────────────────────────────────────────────
  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
  },
  thumbnailPlaceholder: {
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailPlaceholderText: {
    fontSize: 24,
  },

  // ── Card body ────────────────────────────────────────────────────────
  cardBody: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
    gap: 2,
  },
  speciesName: {
    fontSize: 16,
    fontWeight: '700',
    fontStyle: 'italic',
    color: COLORS.darkText,
  },
  confidence: {
    fontSize: 13,
    color: COLORS.secondaryGreen,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  coords: {
    fontSize: 11,
    color: '#999',
  },

  // ── Status badge ─────────────────────────────────────────────────────
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusConfirmed: {
    backgroundColor: '#D4EDDA',
  },
  statusRejected: {
    backgroundColor: '#FDDEDE',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.darkText,
  },

  // ── Empty state ──────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkText,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Export bar ───────────────────────────────────────────────────────
  exportBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightBorder,
  },
  exportButton: {
    backgroundColor: COLORS.primaryGreen,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
