/**
 * @file Welcome / Role Selection Screen.
 *
 * The primary entry point for the BioLens application. Allows users
 * to choose between the Ecologist (Field Capture) and Administrator
 * (Dashboard & Stats) workflows.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { COLORS } from '../constants/theme';

// ─── Sub-components ─────────────────────────────────────────────────────────

interface RoleCardProps {
  title: string;
  icon: string;
  description: string;
  onPress: () => void;
}

/** A card representing a user role. */
function RoleCard({ title, icon, description, onPress }: RoleCardProps): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.cardDescription}>{description}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardActionText}>Access Profile →</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function RoleSelectionScreen(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Decorative top green circle */}
      <View style={styles.circleTop} />

      <View style={styles.content}>
        {/* App Logo & Header */}
        <View style={styles.header}>
          <Text style={styles.logoIcon}>🌿</Text>
          <Text style={styles.logoText}>BioLens</Text>
          <Text style={styles.tagline}>On-Device Ecological Classification</Text>
        </View>

        {/* Roles list */}
        <View style={styles.rolesContainer}>
          <Text style={styles.sectionTitle}>Select Workspace Profile</Text>

          <RoleCard
            title="Field Ecologist"
            icon="📷"
            description="Capture plant specimens, run offline MobileNet-v2 classification, and map geolocated observation sites."
            onPress={() => router.push('/camera')}
          />

          <RoleCard
            title="Biodiversity Admin"
            icon="📊"
            description="Explore biodiversity indices (Shannon Index), monitor site-wise species frequencies, view maps, and export CSV sheets."
            onPress={() => router.push('/admin')}
          />
        </View>

        {/* Footer info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Powered by Local TensorFlow Lite runtime</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  circleTop: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#E2EFE9',
    zIndex: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    zIndex: 1,
  },

  // ── Header ───────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primaryGreen,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.secondaryGreen,
    fontWeight: '600',
    marginTop: 4,
  },

  // ── Roles ────────────────────────────────────────────────────────────
  rolesContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    marginVertical: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    color: COLORS.secondaryGreen,
    textAlign: 'center',
    marginBottom: 8,
  },

  // ── Card ─────────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 20,
    // Soft shadow
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  cardDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  cardActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primaryGreen,
  },

  // ── Footer ───────────────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  footerText: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
  },
});
