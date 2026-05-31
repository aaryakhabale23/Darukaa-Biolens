/**
 * @file Biodiversity and ecology metrics calculations.
 *
 * Implements math calculations for ecological analysis, including the
 * Shannon-Wiener Diversity Index (H'), species counts, site-wise comparisons,
 * and ranking data.
 */

import type { Observation } from '../store/observationStore';

// ─── Types ──────────────────────────────────────────────────────────────

export interface SpeciesStats {
  species: string;
  count: number;
  percentage: number;
}

export interface SiteMetrics {
  siteName: string;
  observationCount: number;
  speciesCount: number;
  shannonIndex: number;
  topSpecies: string;
  topSpeciesCount: number;
}

export interface OverallEcologyStats {
  totalObservations: number;
  uniqueSpeciesCount: number;
  shannonIndex: number;
  mostCommonSpecies: string;
  mostCommonCount: number;
  rareSpeciesCount: number; // Species with only 1 sighting
  speciesDistribution: SpeciesStats[];
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Calculate the Shannon-Wiener Diversity Index (H') for a list of species counts.
 *
 * Formula: H' = - sum( p_i * ln(p_i) )
 * Where p_i is the proportion of total observations belonging to species i.
 *
 * @param speciesCounts - Mapping of species name to their sighting count.
 * @returns The diversity index (usually between 1.5 and 3.5, higher is more diverse).
 */
export function calculateShannonIndex(speciesCounts: Record<string, number>): number {
  const counts = Object.values(speciesCounts);
  const total = counts.reduce((acc, count) => acc + count, 0);

  if (total === 0) return 0;

  let index = 0;
  for (const count of counts) {
    const p = count / total;
    if (p > 0) {
      index -= p * Math.log(p);
    }
  }

  return Number(index.toFixed(3));
}

/**
 * Perform a full ecological audit on an array of observations.
 */
export function auditObservations(observations: Observation[]): OverallEcologyStats {
  const totalObservations = observations.length;

  if (totalObservations === 0) {
    return {
      totalObservations: 0,
      uniqueSpeciesCount: 0,
      shannonIndex: 0,
      mostCommonSpecies: 'None',
      mostCommonCount: 0,
      rareSpeciesCount: 0,
      speciesDistribution: [],
    };
  }

  // 1. Gather sighting frequencies for all confirmed observations
  const counts: Record<string, number> = {};
  for (const obs of observations) {
    const top = obs.predictions[0];
    if (top) {
      counts[top.species] = (counts[top.species] || 0) + 1;
    }
  }

  const uniqueSpeciesCount = Object.keys(counts).length;

  // 2. Calculate Shannon Index
  const shannonIndex = calculateShannonIndex(counts);

  // 3. Find most common and rare species
  let mostCommonSpecies = 'None';
  let mostCommonCount = 0;
  let rareSpeciesCount = 0;

  const distribution: SpeciesStats[] = [];

  for (const [species, count] of Object.entries(counts)) {
    if (count > mostCommonCount) {
      mostCommonSpecies = species;
      mostCommonCount = count;
    }
    if (count === 1) {
      rareSpeciesCount++;
    }

    distribution.push({
      species,
      count,
      percentage: Number(((count / totalObservations) * 100).toFixed(1)),
    });
  }

  // Sort distribution descending by count
  distribution.sort((a, b) => b.count - a.count);

  return {
    totalObservations,
    uniqueSpeciesCount,
    shannonIndex,
    mostCommonSpecies,
    mostCommonCount,
    rareSpeciesCount,
    speciesDistribution: distribution,
  };
}

/**
 * Group observations by site and compute comparative statistics for each.
 */
export function compareSites(observations: Observation[]): SiteMetrics[] {
  const siteGroups: Record<string, Observation[]> = {};

  // Group observations by siteName
  for (const obs of observations) {
    const site = obs.siteName || 'General Field';
    if (!siteGroups[site]) {
      siteGroups[site] = [];
    }
    siteGroups[site]!.push(obs);
  }

  const comparison: SiteMetrics[] = [];

  for (const [siteName, obsList] of Object.entries(siteGroups)) {
    const total = obsList.length;

    // Count species frequencies at this site
    const counts: Record<string, number> = {};
    for (const obs of obsList) {
      const top = obs.predictions[0];
      if (top) {
        counts[top.species] = (counts[top.species] || 0) + 1;
      }
    }

    // Determine top species at this site
    let topSpecies = 'None';
    let topSpeciesCount = 0;

    for (const [species, count] of Object.entries(counts)) {
      if (count > topSpeciesCount) {
        topSpecies = species;
        topSpeciesCount = count;
      }
    }

    const shannonIndex = calculateShannonIndex(counts);
    const speciesCount = Object.keys(counts).length;

    comparison.push({
      siteName,
      observationCount: total,
      speciesCount,
      shannonIndex,
      topSpecies,
      topSpeciesCount,
    });
  }

  // Sort sites by observation count descending
  return comparison.sort((a, b) => b.observationCount - a.observationCount);
}
