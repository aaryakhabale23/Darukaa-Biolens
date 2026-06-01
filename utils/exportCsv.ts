/**
 * @file CSV export utility for BioLens observations.
 *
 * Converts observations into a CSV formatted file and opens the native
 * Share sheet.
 */

import { Alert } from 'react-native';
import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Observation } from '../store/observationStore';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Escape a string value for safe insertion into a CSV cell.
 */
function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Convert observations to CSV and share the file.
 */
export async function exportObservationsCsv(observations: Observation[]): Promise<void> {
  if (observations.length === 0) {
    Alert.alert(
      'No Observations',
      'There are no observations to export. Go identify some plants first!',
    );
    return;
  }

  // 1. Build CSV Header
  const headers = [
    'Observation ID',
    'Timestamp',
    'Status',
    'Latitude',
    'Longitude',
    'GPS Accuracy (m)',
    'Site Name',
    'Primary Match (Top)',
    'Primary Confidence',
    'Secondary Match (#2)',
    'Secondary Confidence',
    'Tertiary Match (#3)',
    'Tertiary Confidence',
    'Image Count',
  ];

  const rows = [headers.join(',')];

  // 2. Add Observation Rows
  for (const obs of observations) {
    const top = obs.predictions[0] ?? null;
    const second = obs.predictions[1] ?? null;
    const third = obs.predictions[2] ?? null;

    const rowData = [
      obs.id,
      obs.timestamp,
      obs.confirmed ? 'Confirmed ✓' : 'Rejected ✗',
      obs.location ? obs.location.lat : '',
      obs.location ? obs.location.lng : '',
      obs.location ? obs.location.accuracy : '',
      obs.siteName || 'General Field',
      top ? top.species : 'Unknown',
      top ? `${(top.confidence * 100).toFixed(1)}%` : '',
      second ? second.species : '',
      second ? `${(second.confidence * 100).toFixed(1)}%` : '',
      third ? third.species : '',
      third ? `${(third.confidence * 100).toFixed(1)}%` : '',
      obs.images.length,
    ];

    rows.push(rowData.map(escapeCsvValue).join(','));
  }

  const csvContent = rows.join('\r\n');

  try {
    // 3. Write file using the new File and Paths API
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `biolens_observations_${today}.csv`;
    const file = new File(Paths.document, fileName);
    if (!file.exists) {
      file.create();
    }
    file.write(csvContent);
    const fileUri = file.uri;

    // 4. Share the file
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (isSharingAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Share BioLens Observations CSV',
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      Alert.alert(
        'CSV Exported',
        `CSV file saved successfully, but sharing is unavailable.\n\nPath: ${fileUri}`,
      );
    }
  } catch (error) {
    console.error('[exportCsv] CSV generation failed:', error);
    Alert.alert('Export Failed', 'An error occurred while generating the CSV report.');
  }
}
