import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

// ─── Theme Colors ────────────────────────────────────────────────────────────
const CONFIDENCE_HIGH = '#40916C'; // ≥ 70%
const CONFIDENCE_MED = '#E9C46A'; // 40–69%
const CONFIDENCE_LOW = '#E76F51'; // < 40%
const TRACK_COLOR = '#E8E8E8';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConfidenceBarProps {
  /** Confidence value in the 0‑1 range (e.g. 0.85 = 85 %). */
  confidence: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the bar fill color for a given confidence value.
 *
 * @param confidence - A number between 0 and 1.
 * @returns Hex color string.
 */
const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.7) return CONFIDENCE_HIGH;
  if (confidence >= 0.4) return CONFIDENCE_MED;
  return CONFIDENCE_LOW;
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * A horizontal animated bar that visualises a confidence level.
 *
 * The bar animates from 0 % → `confidence` % on mount, coloured
 * green / amber / coral depending on the threshold.
 *
 * @example
 * ```tsx
 * <ConfidenceBar confidence={0.82} />
 * ```
 */
const ConfidenceBar: React.FC<ConfidenceBarProps> = ({ confidence }) => {
  // Clamp to [0, 1] to avoid layout issues.
  const clamped = Math.max(0, Math.min(1, confidence));

  // Animated value drives the fill width.
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reset then animate to target whenever confidence changes.
    animValue.setValue(0);
    Animated.timing(animValue, {
      toValue: clamped,
      duration: 600,
      useNativeDriver: false, // width animation can't use native driver
    }).start();
  }, [clamped, animValue]);

  const fillColor = getConfidenceColor(clamped);
  const percentLabel = `${Math.round(clamped * 100)}%`;

  // Interpolate Animated.Value → percentage string for width style.
  const widthInterpolation = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Background track */}
      <View style={styles.track}>
        {/* Animated fill */}
        <Animated.View
          style={[
            styles.fill,
            {
              width: widthInterpolation,
              backgroundColor: fillColor,
            },
          ]}
        />
      </View>

      {/* Percentage label */}
      <Text style={[styles.label, { color: fillColor }]}>{percentLabel}</Text>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: TRACK_COLOR,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 38,
    textAlign: 'right',
  },
});

export default ConfidenceBar;
