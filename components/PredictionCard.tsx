import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import ConfidenceBar from './ConfidenceBar';

// ─── Theme Colors ────────────────────────────────────────────────────────────
const DARK_TEXT = '#1B4332';
const CARD_BG = '#FFFFFF';

// Badge colors for rank 1 / 2 / 3.
const BADGE_COLORS: Record<number, string> = {
  1: '#FFD700', // gold
  2: '#C0C0C0', // silver
  3: '#CD7F32', // bronze
};
const BADGE_DEFAULT = '#B7B7B7'; // fallback for rank > 3

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PredictionCardProps {
  /** Predicted species / taxon name. */
  species: string;
  /** Confidence score in 0‑1 range. */
  confidence: number;
  /** 1‑based prediction rank (1 = best match). */
  rank: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Displays a single species prediction result as a card.
 *
 * - Top‑3 predictions receive a gold / silver / bronze rank badge.
 * - An animated {@link ConfidenceBar} visualises the confidence score.
 *
 * @example
 * ```tsx
 * <PredictionCard species="Ficus religiosa" confidence={0.91} rank={1} />
 * ```
 */
const PredictionCard: React.FC<PredictionCardProps> = ({ species, confidence, rank }) => {
  const badgeColor = BADGE_COLORS[rank] ?? BADGE_DEFAULT;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {/* Rank badge */}
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{rank}</Text>
        </View>

        {/* Species name */}
        <Text style={styles.species} numberOfLines={2}>
          {species}
        </Text>
      </View>

      {/* Confidence bar */}
      <View style={styles.barWrapper}>
        <ConfidenceBar confidence={confidence} />
      </View>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    // Cross‑platform shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  species: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: DARK_TEXT,
    fontStyle: 'italic', // botanical convention: italicise species names
  },
  barWrapper: {
    marginLeft: 40, // align with species text (badge width + margin)
  },
});

export default PredictionCard;
