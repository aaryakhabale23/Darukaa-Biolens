/**
 * @file Camera screen — the home screen of BioLens.
 *
 * Responsibilities:
 * 1. Request camera (and location) permissions on mount.
 * 2. Render a full-screen CameraView viewfinder.
 * 3. Capture photos via a circular shutter button (max 5).
 * 4. Display captured thumbnails in an ImageStrip above the button.
 * 5. Run the ML pipeline (preprocess → infer → top-k) when "Analyze" is tapped.
 * 6. Navigate to `/results` with prediction & location JSON params.
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';

import { preprocessImage } from '../ml/preprocess';
import { runInference } from '../ml/model';
import { getTopK } from '../ml/postprocess';
import { getCurrentLocation, requestLocationPermission } from '../utils/geoLocation';
import { useObservationStore } from '../store/observationStore';
import ImageStrip from '../components/ImageStrip';

// ─── Constants ──────────────────────────────────────────────────────────────
const MAX_IMAGES = 5;
const TOP_K = 3;

const COLORS = {
  primaryGreen: '#2D6A4F',
  secondaryGreen: '#52B788',
  accent: '#95D5B2',
  background: '#F0F7F4',
  darkText: '#1B4332',
  white: '#FFFFFF',
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * CameraScreen — full-screen camera viewfinder with capture + analyze flow.
 */
export default function CameraScreen(): React.JSX.Element {
  // ── Camera permission ──────────────────────────────────────────────────
  const [permission, requestPermission] = useCameraPermissions();

  // ── Refs & state ───────────────────────────────────────────────────────
  const cameraRef = useRef<CameraView>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ── Store ──────────────────────────────────────────────────────────────
  const currentImages = useObservationStore((s) => s.currentImages);
  const addImage = useObservationStore((s) => s.addImage);
  const removeImage = useObservationStore((s) => s.removeImage);
  const clearCurrentImages = useObservationStore((s) => s.clearCurrentImages);

  // ── Request location permission on mount ──────────────────────────────
  useEffect(() => {
    requestLocationPermission();
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────

  /**
   * Capture a photo from the camera and store the URI.
   * Enforces the MAX_IMAGES limit.
   */
  const handleCapture = useCallback(async () => {
    if (currentImages.length >= MAX_IMAGES) {
      Alert.alert('Limit reached', `You can capture up to ${MAX_IMAGES} images per observation.`);
      return;
    }

    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.8,
        skipProcessing: Platform.OS === 'android', // faster on Android
      });

      if (photo?.uri) {
        addImage(photo.uri);
      }
    } catch (err) {
      console.error('[CameraScreen] Capture failed:', err);
      Alert.alert('Capture error', 'Could not take a photo. Please try again.');
    }
  }, [currentImages.length, addImage]);

  /**
   * Run the full ML pipeline on the first captured image:
   * preprocess → load model → inference → top-K → navigate.
   */
  const handleAnalyze = useCallback(async () => {
    if (currentImages.length === 0) return;

    setIsAnalyzing(true);
    try {
      // 1. Acquire GPS (best-effort)
      let location: { lat: number; lng: number; accuracy: number } | null = null;
      try {
        location = await getCurrentLocation();
      } catch {
        console.warn('[CameraScreen] Location unavailable — continuing without it.');
      }

      // 2. Preprocess the first image
      const inputTensor = await preprocessImage(currentImages[0]);

      // 3. Run inference
      const outputTensor = await runInference(inputTensor);

      // 4. Extract top-K predictions
      const predictions = getTopK(outputTensor, TOP_K);

      // 5. Navigate to results
      router.push({
        pathname: '/results',
        params: {
          predictions: JSON.stringify(predictions),
          location: JSON.stringify(location),
        },
      });
    } catch (err) {
      console.error('[CameraScreen] Analysis failed:', err);
      Alert.alert(
        'Analysis error',
        'Something went wrong while identifying the plant. Please try again.',
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [currentImages]);

  /** Navigate to the history screen. */
  const handleHistory = useCallback(() => {
    router.push('/history');
  }, []);

  // ── Permission gate ────────────────────────────────────────────────────

  if (!permission) {
    // Permissions are still loading
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={COLORS.primaryGreen} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionBody}>
          BioLens needs your camera to identify plants. Tap below to grant access.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────

  const hasImages = currentImages.length > 0;

  return (
    <View style={styles.container}>
      {/* Camera viewfinder */}
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />

      {/* ── Top overlay ──────────────────────────────────────────── */}
      <View style={styles.topOverlay}>
        {/* Exit to Role Selection */}
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => router.replace('/')}
          activeOpacity={0.8}
        >
          <Text style={styles.historyButtonText}>← Exit</Text>
        </TouchableOpacity>

        {/* Image count badge */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {currentImages.length}/{MAX_IMAGES}
          </Text>
        </View>

        {/* History button */}
        <TouchableOpacity
          style={styles.historyButton}
          onPress={handleHistory}
          activeOpacity={0.8}
        >
          <Text style={styles.historyButtonText}>History</Text>
        </TouchableOpacity>
      </View>

      {/* ── Bottom overlay ───────────────────────────────────────── */}
      <View style={styles.bottomOverlay}>
        {/* Thumbnail strip */}
        {hasImages && <ImageStrip images={currentImages} onRemove={removeImage} />}

        {/* Controls row */}
        <View style={styles.controlsRow}>
          {/* Analyze button (left slot) */}
          <View style={styles.sideSlot}>
            {hasImages && (
              <TouchableOpacity
                style={[styles.analyzeButton, isAnalyzing && styles.analyzeButtonDisabled]}
                onPress={handleAnalyze}
                disabled={isAnalyzing}
                activeOpacity={0.8}
              >
                {isAnalyzing ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.analyzeButtonText}>Analyze</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Capture button (center) */}
          <TouchableOpacity
            style={styles.captureButtonOuter}
            onPress={handleCapture}
            disabled={isAnalyzing}
            activeOpacity={0.7}
          >
            <View
              style={[styles.captureButtonInner, isAnalyzing && styles.captureButtonDisabled]}
            />
          </TouchableOpacity>

          {/* Clear button (right slot) */}
          <View style={styles.sideSlot}>
            {hasImages && !isAnalyzing && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearCurrentImages}
                activeOpacity={0.8}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Full-screen loading overlay while analyzing */}
      {isAnalyzing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.white} />
          <Text style={styles.loadingText}>Identifying plant…</Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CAPTURE_OUTER = 72;
const CAPTURE_INNER = 60;

const styles = StyleSheet.create({
  // ── Layout ───────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },

  // ── Permission gate ──────────────────────────────────────────────────
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 32,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.darkText,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: 15,
    color: COLORS.darkText,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: COLORS.primaryGreen,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },

  // ── Top overlay ──────────────────────────────────────────────────────
  topOverlay: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  historyButton: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  historyButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Bottom overlay ───────────────────────────────────────────────────
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 36,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 16,
  },
  sideSlot: {
    flex: 1,
    alignItems: 'center',
  },

  // ── Capture button ───────────────────────────────────────────────────
  captureButtonOuter: {
    width: CAPTURE_OUTER,
    height: CAPTURE_OUTER,
    borderRadius: CAPTURE_OUTER / 2,
    borderWidth: 4,
    borderColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: CAPTURE_INNER,
    height: CAPTURE_INNER,
    borderRadius: CAPTURE_INNER / 2,
    backgroundColor: COLORS.white,
  },
  captureButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },

  // ── Analyze button ───────────────────────────────────────────────────
  analyzeButton: {
    backgroundColor: COLORS.secondaryGreen,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  analyzeButtonDisabled: {
    opacity: 0.6,
  },
  analyzeButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },

  // ── Clear button ─────────────────────────────────────────────────────
  clearButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  clearButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },

  // ── Loading overlay ──────────────────────────────────────────────────
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
});
