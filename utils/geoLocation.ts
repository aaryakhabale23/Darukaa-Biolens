/**
 * @file GPS location utilities for BioLens.
 *
 * Wraps expo-location to provide a simple API for requesting foreground
 * permissions and reading high-accuracy GPS coordinates. Every function
 * degrades gracefully — returning `false` or `null` — so callers never
 * need to handle thrown errors.
 */

import * as Location from 'expo-location';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Simplified GPS coordinate payload returned by {@link getCurrentLocation}. */
export interface GeoCoordinate {
  /** Latitude in decimal degrees. */
  lat: number;
  /** Longitude in decimal degrees. */
  lng: number;
  /** Horizontal accuracy radius in metres. */
  accuracy: number;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Request foreground location permission from the user.
 *
 * If the permission has already been granted the function returns `true`
 * immediately without showing a system dialog.
 *
 * @returns `true` when foreground location access is granted, `false` otherwise.
 *
 * @example
 * ```ts
 * const granted = await requestLocationPermission();
 * if (!granted) {
 *   Alert.alert('Location access is needed to tag observations.');
 * }
 * ```
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[geoLocation] Permission request failed:', error);
    return false;
  }
}

/**
 * Read the device's current GPS position at high accuracy.
 *
 * Automatically requests permission if it hasn't been granted yet.
 * Returns `null` when the position cannot be determined (permission
 * denied, timeout, airplane mode, etc.).
 *
 * @returns A {@link GeoCoordinate} on success, or `null` on failure.
 *
 * @example
 * ```ts
 * const coords = await getCurrentLocation();
 * if (coords) {
 *   console.log(`Lat: ${coords.lat}, Lng: ${coords.lng}`);
 * }
 * ```
 */
export async function getCurrentLocation(): Promise<GeoCoordinate | null> {
  try {
    // Ensure we have permission before attempting to read location.
    const granted = await requestLocationPermission();
    if (!granted) {
      console.warn('[geoLocation] Location permission denied.');
      return null;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy ?? 0,
    };
  } catch (error) {
    console.error('[geoLocation] Failed to get current location:', error);
    return null;
  }
}
