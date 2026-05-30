/**
 * @file Root layout for the BioLens app.
 *
 * Configures the Expo Router Stack navigator with a unified header
 * theme drawn from the BioLens green color palette. All three top-level
 * routes (Camera, Results, History) are registered here.
 */

import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type NativeStackNavigationOptions } from '@react-navigation/native-stack';

// ─── Color Palette ──────────────────────────────────────────────────────────
const COLORS = {
  primaryGreen: '#2D6A4F',
  white: '#FFFFFF',
} as const;

/** Shared header options applied to every screen in the stack. */
const defaultScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: COLORS.primaryGreen },
  headerTintColor: COLORS.white,
  headerTitleStyle: { fontWeight: 'bold' },
  headerShadowVisible: false,
  animation: 'slide_from_right',
};

/**
 * RootLayout — the top-level navigator for BioLens.
 *
 * Renders a `Stack` with three screens:
 * - `index`   → Camera / capture screen (home)
 * - `results` → ML prediction results
 * - `history` → Saved observation history
 */
export default function RootLayout(): React.JSX.Element {
  return (
    <>
      {/* Keep a light status bar to contrast the dark-green header */}
      <StatusBar style="light" />

      <Stack screenOptions={defaultScreenOptions}>
        <Stack.Screen name="index" options={{ title: 'BioLens' }} />
        <Stack.Screen name="results" options={{ title: 'Results' }} />
        <Stack.Screen name="history" options={{ title: 'History' }} />
      </Stack>
    </>
  );
}
