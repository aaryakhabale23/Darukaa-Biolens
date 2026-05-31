/**
 * @file Admin Dashboard Screen.
 *
 * Implements the ecology analytics dashboard, including biodiversity statistics,
 * Shannon index math, site comparisons, CSV data export, and geo-mapping.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
  Dimensions,
} from 'react-native';

import { router } from 'expo-router';

import { useObservationStore, Observation } from '../store/observationStore';
import { auditObservations, compareSites, SiteMetrics } from '../utils/ecology';
import { exportObservationsCsv } from '../utils/exportCsv';
import { exportObservationsPdf } from '../utils/exportPdf';

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

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AdminDashboardScreen(): React.JSX.Element {
  const observations = useObservationStore((s) => s.observations);
  const generateMockData = useObservationStore((s) => s.generateMockData);
  const clearCurrentImages = useObservationStore((s) => s.clearCurrentImages);
  const clearMockObservations = useObservationStore((s) => s.clearMockObservations);

  const [activeTab, setActiveTab] = useState<'stats' | 'sites'>('stats');

  // ── Compute Analytics ──────────────────────────────────────────────────
  const stats = useMemo(() => auditObservations(observations), [observations]);
  const siteComparisons = useMemo(() => compareSites(observations), [observations]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleExportCsv = useCallback(async () => {
    await exportObservationsCsv(observations);
  }, [observations]);

  const handleExportPdf = useCallback(async () => {
    await exportObservationsPdf(observations);
  }, [observations]);

  const handleGenerateMock = useCallback(() => {
    generateMockData();
    Alert.alert('Mock Data Generated', '55 diverse ecological observations added successfully.');
  }, [generateMockData]);

  const handleResetData = useCallback(() => {
    Alert.alert(
      'Clear Mock Data',
      'Are you sure you want to delete only the generated mock observations? Your user captured images will be kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Mock Data',
          style: 'destructive',
          onPress: () => {
            clearMockObservations();
            clearCurrentImages();
            Alert.alert('Mock Data Cleared', 'All mock observations have been removed.');
          },
        },
      ],
    );
  }, [clearMockObservations, clearCurrentImages]);

  // ── Render Helpers ────────────────────────────────────────────────────

  const renderStatsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* ── Summary Stats Grid ── */}
      <View style={styles.grid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Observations</Text>
          <Text style={styles.statValue}>{stats.totalObservations}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Unique Species</Text>
          <Text style={styles.statValue}>{stats.uniqueSpeciesCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Shannon Index (H')</Text>
          <Text style={styles.statValue}>{stats.shannonIndex}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Rare Species (Singular)</Text>
          <Text style={styles.statValue}>{stats.rareSpeciesCount}</Text>
        </View>
      </View>

      {/* ── Species distribution chart / list ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Species Frequency Distribution</Text>
        {stats.speciesDistribution.length === 0 ? (
          <Text style={styles.emptyText}>No data available. Generate mock data or record observations.</Text>
        ) : (
          stats.speciesDistribution.map((item) => (
            <View key={item.species} style={styles.distRow}>
              <View style={styles.distLeft}>
                <Text style={styles.speciesText}>{item.species}</Text>
                <Text style={styles.speciesCountText}>{item.count} observations</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${item.percentage}%` }]} />
              </View>
              <Text style={styles.percentageText}>{item.percentage}%</Text>
            </View>
          ))
        )}
      </View>

      {/* ── Developer controls ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Developer Tools</Text>
        <View style={styles.devControlsRow}>
          <TouchableOpacity style={styles.mockButton} onPress={handleGenerateMock}>
            <Text style={styles.mockButtonText}>Generate Mock Data</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetButton} onPress={handleResetData}>
            <Text style={styles.resetButtonText}>Clear Mock Data</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderSitesTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Site Comparison Analysis</Text>
        <Text style={styles.subtext}>
          Displays biodiversity parameters aggregated by site. A higher Shannon Index (H') indicates greater species richness and evenness.
        </Text>

        {siteComparisons.length === 0 ? (
          <Text style={styles.emptyText}>No site comparison records found.</Text>
        ) : (
          siteComparisons.map((site: SiteMetrics) => (
            <View key={site.siteName} style={styles.siteCard}>
              <View style={styles.siteHeader}>
                <Text style={styles.siteName}>{site.siteName}</Text>
                <View style={styles.shannonBadge}>
                  <Text style={styles.shannonLabel}>H' = {site.shannonIndex}</Text>
                </View>
              </View>

              <View style={styles.siteGrid}>
                <View style={styles.siteGridItem}>
                  <Text style={styles.siteMetricLabel}>Observations</Text>
                  <Text style={styles.siteMetricValue}>{site.observationCount}</Text>
                </View>
                <View style={styles.siteGridItem}>
                  <Text style={styles.siteMetricLabel}>Unique Species</Text>
                  <Text style={styles.siteMetricValue}>{site.speciesCount}</Text>
                </View>
                <View style={styles.siteGridItem}>
                  <Text style={styles.siteMetricLabel}>Top Species</Text>
                  <Text style={styles.siteMetricValue} numberOfLines={1}>
                    {site.topSpecies}
                  </Text>
                  <Text style={styles.siteMetricSub}>{site.topSpeciesCount} sightings</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* ── Tabs selector ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'stats' && styles.tabButtonActive]}
          onPress={() => setActiveTab('stats')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'stats' && styles.tabButtonTextActive]}>Statistics</Text>
        </TouchableOpacity>
<TouchableOpacity
          style={[styles.tabButton, activeTab === 'sites' && styles.tabButtonActive]}
          onPress={() => setActiveTab('sites')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'sites' && styles.tabButtonTextActive]}>Sites</Text>
        </TouchableOpacity>
      </View>

      {/* ── Active Tab Display ── */}
      <View style={styles.container}>
        {activeTab === 'stats' && renderStatsTab()}

        {activeTab === 'sites' && renderSitesTab()}
      </View>

      {/* ── Export Controls Bar ── */}
      {observations.length > 0 && (
        <View style={styles.exportBar}>
          <TouchableOpacity style={styles.exportButtonSecondary} onPress={handleExportCsv} activeOpacity={0.8}>
            <Text style={styles.exportButtonTextSecondary}>CSV Export</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportButtonPrimary} onPress={handleExportPdf} activeOpacity={0.8}>
            <Text style={styles.exportButtonTextPrimary}>PDF Report</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightBorder,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: COLORS.primaryGreen,
  },
  tabButtonText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: COLORS.primaryGreen,
    fontWeight: '700',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },

  // ── Stats tab grid ───────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    padding: 16,
    flex: 1,
    minWidth: '45%',
    // subtle shadow
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#777',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primaryGreen,
  },

  // ── Section card ──────────────────────────────────────────────────────
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.darkText,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 6,
  },
  subtext: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 12,
  },

  // ── Species distribution lists ─────────────────────────────────────────
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  distLeft: {
    width: 130,
  },
  speciesText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.darkText,
    fontStyle: 'italic',
  },
  speciesCountText: {
    fontSize: 11,
    color: '#777',
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primaryGreen,
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryGreen,
    width: 38,
    textAlign: 'right',
  },

  // ── Dev controls ─────────────────────────────────────────────────────
  devControlsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mockButton: {
    flex: 1.5,
    backgroundColor: COLORS.primaryGreen,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  mockButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
  resetButton: {
    flex: 1,
    backgroundColor: COLORS.coral,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  resetButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },

  // ── Sites tab ────────────────────────────────────────────────────────
  siteCard: {
    backgroundColor: '#F8FAF9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2EFE9',
    padding: 14,
    marginBottom: 12,
  },
  siteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  siteName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  shannonBadge: {
    backgroundColor: COLORS.primaryGreen,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  shannonLabel: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  siteGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  siteGridItem: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#EEF4EE',
  },
  siteMetricLabel: {
    fontSize: 9,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  siteMetricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  siteMetricSub: {
    fontSize: 9,
    color: COLORS.secondaryGreen,
  },

  // ── Bottom export bar ────────────────────────────────────────────────
  exportBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightBorder,
    gap: 12,
  },
  exportButtonPrimary: {
    flex: 1,
    backgroundColor: COLORS.primaryGreen,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  exportButtonTextPrimary: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  exportButtonSecondary: {
    flex: 1,
    backgroundColor: '#F0F7F4',
    borderWidth: 1,
    borderColor: COLORS.primaryGreen,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  exportButtonTextSecondary: {
    color: COLORS.primaryGreen,
    fontSize: 15,
    fontWeight: '700',
  },
});
