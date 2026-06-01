/**
 * @file Root layout for the BioLens app.
 *
 * Configures the Expo Router Stack navigator with a unified header
 * theme drawn from the BioLens green color palette. All three top-level
 * routes (Camera, Results, History) are registered here.
 */

import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../constants/theme';
import { useObservationStore } from '../store/observationStore';
import ErrorBoundary from '../components/ErrorBoundary';

/** Shared header options applied to every screen in the stack. */
const defaultScreenOptions = {
  headerStyle: { backgroundColor: COLORS.primaryGreen },
  headerTintColor: COLORS.white,
  headerTitleStyle: { fontWeight: 'bold' as const },
  headerShadowVisible: false,
  animation: 'slide_from_right' as const,
};

/**
 * RootLayout — the top-level navigator for BioLens.
 */
export default function RootLayout(): React.JSX.Element {
  const loadObservations = useObservationStore((s) => s.loadObservations);

  useEffect(() => {
    loadObservations().catch((err) => {
      console.error('[RootLayout] Error hydrating store:', err);
    });
  }, [loadObservations]);

  return (
    <ErrorBoundary>
      {/* Keep a light status bar to contrast the dark-green header */}
      <StatusBar style="light" />

      <Stack screenOptions={defaultScreenOptions}>
        <Stack.Screen name="index" options={{ title: 'Welcome', headerShown: false }} />
        <Stack.Screen name="camera" options={{ title: 'Field Capture', headerShown: false }} />
        <Stack.Screen name="admin" options={{ title: 'Admin Dashboard' }} />
        <Stack.Screen name="results" options={{ title: 'Results' }} />
        <Stack.Screen name="history" options={{ title: 'History' }} />
      </Stack>
    </ErrorBoundary>
  );
}
