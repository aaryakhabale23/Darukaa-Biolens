/**
 * @file JSON export utility for BioLens observations.
 *
 * Writes the observation array to a dated JSON file in the app's
 * document directory and opens the native Share sheet so the user
 * can send the file via email, AirDrop, cloud drive, etc.
 *
 * Falls back to a simple Alert when sharing isn't available (e.g.
 * some Android emulators).
 */

import { Alert, Share, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

import type { Observation } from '../store/observationStore';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a date-stamped filename for the export.
 *
 * @returns e.g. `biolens_observations_2026-05-30.json`
 */
function buildFileName(): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `biolens_observations_${today}.json`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Export an array of observations as a shareable JSON file.
 *
 * **Flow:**
 * 1. Validate that the array is non-empty (shows an alert otherwise).
 * 2. Serialise to pretty-printed JSON.
 * 3. Write the JSON to `FileSystem.documentDirectory`.
 * 4. Open the native Share sheet so the user can forward the file.
 *    - On iOS the file URI is shared directly.
 *    - On Android the file content is shared as a text message (since
 *      `Share.share` doesn't support file URIs natively). For a richer
 *      experience consider adding `expo-sharing` in the future.
 * 5. If sharing fails or is unavailable, show an alert with the file path.
 *
 * @param observations - The observations to export.
 *
 * @example
 * ```ts
 * const observations = useObservationStore.getState().observations;
 * await exportObservations(observations);
 * ```
 */
export async function exportObservations(observations: Observation[]): Promise<void> {
  // ── Guard: nothing to export ────────────────────────────────────────────
  if (observations.length === 0) {
    Alert.alert(
      'No Observations',
      'There are no observations to export. Go identify some plants first!',
    );
    return;
  }

  const fileName = buildFileName();
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;

  try {
    // ── Write JSON to disk ──────────────────────────────────────────────
    const json = JSON.stringify(observations, null, 2);
    await FileSystem.writeAsStringAsync(fileUri, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // ── Share the file ──────────────────────────────────────────────────
    try {
      if (Platform.OS === 'ios') {
        // iOS supports sharing file URIs directly.
        await Share.share({ url: fileUri });
      } else {
        // Android: share the JSON as text content via the Share sheet.
        // For large payloads consider switching to expo-sharing which
        // supports file URIs cross-platform.
        await Share.share({
          title: fileName,
          message: json,
        });
      }
    } catch (shareError: unknown) {
      // User dismissed the share sheet — not a real error.
      if (shareError instanceof Error && shareError.message?.includes('dismiss')) {
        return;
      }

      // Genuine failure — fall back to showing the file path.
      Alert.alert('Export Saved', `Observations have been saved to:\n${fileUri}`);
    }
  } catch (error) {
    console.error('[exportJson] Export failed:', error);
    Alert.alert('Export Failed', 'Something went wrong while exporting observations.');
  }
}
