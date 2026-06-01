import React, { useCallback } from 'react';
import {
  FlatList,
  Image,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS } from '../constants/theme';

/** Maximum number of observation images the app allows. */
const MAX_IMAGES = 5;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImageStripProps {
  /** Array of local image URIs (file:// paths). */
  images: string[];
  /**
   * Called when the user taps the remove button on a thumbnail.
   * If omitted the remove buttons are hidden.
   */
  onRemove?: (index: number) => void;
}

// ─── Sub‑components ──────────────────────────────────────────────────────────

/**
 * Single thumbnail cell inside the strip.
 */
const Thumbnail: React.FC<{
  uri: string;
  index: number;
  onRemove?: (index: number) => void;
}> = ({ uri, index, onRemove }) => (
  <View style={styles.thumbnailWrapper}>
    <Image source={{ uri }} style={styles.thumbnail} />
    {onRemove && (
      <Pressable
        style={styles.removeBtn}
        hitSlop={6}
        onPress={() => onRemove(index)}
        accessibilityLabel={`Remove image ${index + 1}`}
        accessibilityRole="button"
      >
        <Text style={styles.removeBtnText}>✕</Text>
      </Pressable>
    )}
  </View>
);

/**
 * Dashed‑border placeholder shown when the image list is empty.
 */
const EmptyPlaceholder: React.FC = () => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderIcon}>📷</Text>
    <Text style={styles.placeholderText}>Tap to capture</Text>
  </View>
);

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * A horizontal scrollable strip of observation image thumbnails.
 *
 * - Shows a dashed placeholder when there are no images.
 * - Displays an "n / 5" counter badge on the trailing edge.
 * - Each thumbnail has an optional "✕" overlay to remove it.
 *
 * @example
 * ```tsx
 * <ImageStrip
 *   images={observationImages}
 *   onRemove={(idx) => removeImage(idx)}
 * />
 * ```
 */
const ImageStrip: React.FC<ImageStripProps> = ({ images, onRemove }) => {
  // Stable key extractor – index is fine here; the list is tiny (≤ 5).
  const keyExtractor = useCallback((_item: string, index: number) => `thumb-${index}`, []);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<string>) => (
      <Thumbnail uri={item} index={index} onRemove={onRemove} />
    ),
    [onRemove],
  );

  // ── Empty state ──────────────────────────────────────────────────────────
  if (images.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyPlaceholder />
      </View>
    );
  }

  // ── Populated state ──────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <FlatList
        data={images}
        horizontal
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />

      {/* Image counter badge */}
      <View style={styles.counterBadge}>
        <Text style={styles.counterText}>
          {images.length}/{MAX_IMAGES}
        </Text>
      </View>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listContent: {
    gap: 8,
    paddingVertical: 4,
  },

  // ── Thumbnail ────────────────────────────────────────────────────────────
  thumbnailWrapper: {
    position: 'relative',
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.lightBorder,
    backgroundColor: '#F5F5F5',
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primaryGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },

  // ── Empty placeholder ────────────────────────────────────────────────────
  placeholder: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  placeholderText: {
    fontSize: 9,
    color: COLORS.darkText,
    fontWeight: '500',
  },

  // ── Counter badge ────────────────────────────────────────────────────────
  counterBadge: {
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.darkText,
  },
});

export default ImageStrip;
