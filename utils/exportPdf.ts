/**
 * @file PDF export utility for BioLens observations.
 *
 * Uses expo-print to generate a beautifully styled PDF from HTML and
 * expo-sharing to open the native sharing sheet.
 */

import { Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Observation } from '../store/observationStore';
import { auditObservations, compareSites } from './ecology';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format a timestamp into a human-readable date and time.
 */
function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return isoString;
  }
}

/**
 * Generate the HTML template for the PDF.
 */
function generateHtml(observations: Observation[]): string {
  const exportDate = new Date().toLocaleDateString(undefined, {
    dateStyle: 'long',
  });

  const totalObs = observations.length;
  const stats = auditObservations(observations);
  const siteComparisons = compareSites(observations);

  // 1. Generate Site Comparisons Table Rows
  const siteRowsHtml = siteComparisons
    .map(
      (site) => `
      <tr>
        <td><strong>${site.siteName}</strong></td>
        <td style="text-align: center;">${site.observationCount}</td>
        <td style="text-align: center;">${site.speciesCount}</td>
        <td style="text-align: center; font-weight: bold; color: #2d6a4f;">${site.shannonIndex}</td>
        <td class="species-name" style="font-style: italic;">${site.topSpecies} <span style="font-weight: normal; font-style: normal; font-size: 9px; color: #666;">(${site.topSpeciesCount} sightings)</span></td>
      </tr>
    `,
    )
    .join('');

  // 2. Generate Compact Observations Table Rows
  const obsRowsHtml = observations
    .map((obs, idx) => {
      const topPrediction = obs.predictions[0];
      const title = topPrediction ? topPrediction.species : 'Unknown Species';
      const confidence = topPrediction ? `${(topPrediction.confidence * 100).toFixed(1)}%` : '0.0%';
      const statusLabel = obs.confirmed ? 'Confirmed' : 'Rejected';
      const statusClass = obs.confirmed ? 'status-confirmed' : 'status-rejected';

      return `
        <tr>
          <td style="font-weight: bold; color: #666;">#${totalObs - idx}</td>
          <td class="species-name">${title}</td>
          <td style="font-weight: bold; color: #2d6a4f;">${confidence}</td>
          <td>${obs.siteName || 'General Field'}</td>
          <td style="text-align: center;"><span class="status-badge ${statusClass}">${statusLabel}</span></td>
          <td style="color: #555; font-size: 10px;">${formatDateTime(obs.timestamp)}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>BioLens Biodiversity Field Report</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1b4332;
            background-color: #ffffff;
            margin: 0;
            padding: 30px;
            font-size: 12px;
            line-height: 1.4;
          }
          header {
            border-bottom: 3px solid #2d6a4f;
            padding-bottom: 12px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .title-group h1 {
            color: #2d6a4f;
            margin: 0;
            font-size: 26px;
            font-weight: 800;
            letter-spacing: -0.5px;
          }
          .title-group p {
            margin: 4px 0 0 0;
            color: #52b788;
            font-size: 13px;
            font-weight: 600;
          }
          .report-meta {
            text-align: right;
            font-size: 11px;
            color: #666;
            line-height: 1.3;
          }
          .stats-panel {
            background-color: #f0f7f4;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 25px;
            display: flex;
            justify-content: space-around;
            border: 1px solid #95d5b2;
          }
          .stat-item {
            text-align: center;
            flex: 1;
          }
          .stat-val {
            font-size: 20px;
            font-weight: bold;
            color: #2d6a4f;
            display: block;
            margin-bottom: 2px;
          }
          .stat-lbl {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #666;
            font-weight: 600;
          }
          h2 {
            font-size: 15px;
            color: #2d6a4f;
            margin-top: 25px;
            margin-bottom: 12px;
            border-bottom: 1px solid #95d5b2;
            padding-bottom: 5px;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          th {
            background-color: #2d6a4f;
            color: #ffffff;
            text-align: left;
            padding: 10px 8px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td {
            padding: 10px 8px;
            border-bottom: 1px solid #e0e0e0;
            font-size: 11px;
          }
          tr:nth-child(even) {
            background-color: #f8faf9;
          }
          .species-name {
            font-style: italic;
            font-weight: 700;
            color: #1b4332;
          }
          .status-badge {
            font-size: 9px;
            font-weight: bold;
            padding: 3px 8px;
            border-radius: 10px;
            display: inline-block;
            text-align: center;
          }
          .status-confirmed {
            background-color: #d8f3dc;
            color: #40916c;
          }
          .status-rejected {
            background-color: #fcd5ce;
            color: #e76f51;
          }
        </style>
      </head>
      <body>
        <header>
          <div class="title-group">
            <h1>BioLens Field Report</h1>
            <p>Biodiversity & Ecological Audit</p>
          </div>
          <div class="report-meta">
            <strong>Date:</strong> ${exportDate}<br/>
            <strong>Engine:</strong> MobileNet-v2 (Local Runtime)
          </div>
        </header>

        <div class="stats-panel">
          <div class="stat-item" style="border-right: 1px solid #d5e8dc;">
            <span class="stat-val">${stats.totalObservations}</span>
            <span class="stat-lbl">Observations</span>
          </div>
          <div class="stat-item" style="border-right: 1px solid #d5e8dc;">
            <span class="stat-val">${stats.uniqueSpeciesCount}</span>
            <span class="stat-lbl">Unique Species</span>
          </div>
          <div class="stat-item" style="border-right: 1px solid #d5e8dc;">
            <span class="stat-val" style="color: #40916c;">${stats.shannonIndex}</span>
            <span class="stat-lbl">Shannon (H')</span>
          </div>
          <div class="stat-item">
            <span class="stat-val" style="color: #e76f51;">${stats.rareSpeciesCount}</span>
            <span class="stat-lbl">Rare Species</span>
          </div>
        </div>

        <h2>Site-Wise Diversity Analysis</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">Site Name</th>
              <th style="width: 15%; text-align: center;">Sightings</th>
              <th style="width: 15%; text-align: center;">Species</th>
              <th style="width: 15%; text-align: center;">Shannon Index (H')</th>
              <th style="width: 30%;">Top Dominant Species</th>
            </tr>
          </thead>
          <tbody>
            ${siteRowsHtml}
          </tbody>
        </table>

        <h2>Detailed Sighting Records</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 10%;">ID</th>
              <th style="width: 30%;">Species Target</th>
              <th style="width: 15%;">Confidence</th>
              <th style="width: 20%;">Observation Site</th>
              <th style="width: 10%; text-align: center;">Status</th>
              <th style="width: 15%;">Date & Time</th>
            </tr>
          </thead>
          <tbody>
            ${obsRowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Export observations as a beautifully styled PDF document and share it.
 */
export async function exportObservationsPdf(observations: Observation[]): Promise<void> {
  if (observations.length === 0) {
    Alert.alert(
      'No Observations',
      'There are no observations to export. Go identify some plants first!',
    );
    return;
  }

  try {
    // 1. Generate the raw HTML representation of the PDF report
    const html = generateHtml(observations);

    // 2. Print HTML template to a temporary PDF file
    const { uri } = await Print.printToFileAsync({ html });

    // 3. Make sure native sharing is available on the device
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (isSharingAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share BioLens Observations PDF',
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert(
        'PDF Generated',
        `PDF saved successfully, but sharing is unavailable on this device.\n\nPath: ${uri}`,
      );
    }
  } catch (error) {
    console.error('[exportPdf] Failed to export PDF:', error);
    Alert.alert('Export Failed', 'An error occurred while generating your PDF report.');
  }
}
