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
import { Paths, File } from 'expo-file-system';

import type { Observation } from '../store/observationStore';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a date-stamped filename for the export.
 *
 * @returns e.g. `biolens_observations_2026-05-31.csv`
 */
function buildFileName(): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `biolens_observations_${today}.csv`;
}

/**
 * Convert an array of plant observations into a CSV formatted string.
 * Escapes fields containing commas, double quotes, or newlines for Excel compatibility.
 */
function convertToCSV(observations: Observation[]): string {
  const headers = [
    'Observation ID',
    'Timestamp',
    'Status',
    'Latitude',
    'Longitude',
    'GPS Accuracy (m)',
    'Primary Match (Top)',
    'Primary Confidence',
    'Secondary Match (#2)',
    'Secondary Confidence',
    'Tertiary Match (#3)',
    'Tertiary Confidence',
    'Image Count',
    'Synced'
  ];

  const rows = observations.map((obs) => {
    const top = obs.predictions[0] || { species: 'N/A', confidence: 0 };
    const sec = obs.predictions[1] || { species: 'N/A', confidence: 0 };
    const tert = obs.predictions[2] || { species: 'N/A', confidence: 0 };
    const statusText = obs.confirmed ? 'Confirmed ✓' : 'Rejected ✗';

    const fields = [
      obs.id,
      obs.timestamp,
      statusText,
      obs.location ? obs.location.lat : 'N/A',
      obs.location ? obs.location.lng : 'N/A',
      obs.location ? obs.location.accuracy : 'N/A',
      top.species,
      `${(top.confidence * 100).toFixed(1)}%`,
      sec.species,
      `${(sec.confidence * 100).toFixed(1)}%`,
      tert.species,
      `${(tert.confidence * 100).toFixed(1)}%`,
      obs.images.length,
      obs.synced ? 'Yes' : 'No'
    ];

    return fields
      .map((val) => {
        const text = String(val);
        // Escape quotes and wrap in quotes if it contains delimiters
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
          return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
      })
      .join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Export an array of observations as a shareable CSV spreadsheet file.
 *
 * **Flow:**
 * 1. Validate that the array is non-empty.
 * 2. Convert observations to CSV layout.
 * 3. Write CSV to D:\.gradle document directory.
 * 4. Trigger Native Share sheet to open or save the document directly.
 *
 * @param observations - The observations to export.
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

  try {
    // ── Write CSV to disk ──────────────────────────────────────────────
    const file = new File(Paths.document, fileName);
    if (!file.exists) {
      file.create();
    }
    const csvContent = convertToCSV(observations);
    file.write(csvContent);
    const fileUri = file.uri;

    // ── Share the file ──────────────────────────────────────────────────
    try {
      if (Platform.OS === 'ios') {
        // iOS supports sharing file URIs directly
        await Share.share({ url: fileUri });
      } else {
        // Android: Share sheet supports sharing text content directly.
        // For files, sharing the raw CSV text triggers Sheets/Excel handlers.
        await Share.share({
          title: fileName,
          message: csvContent,
        });
      }
    } catch (shareError: unknown) {
      if (shareError instanceof Error && shareError.message?.includes('dismiss')) {
        return;
      }
      Alert.alert('Export Saved', `Observations saved to:\n${fileUri}`);
    }
  } catch (error) {
    console.error('[exportCsv] Export failed:', error);
    Alert.alert('Export Failed', 'Something went wrong while exporting observations.');
  }
}
