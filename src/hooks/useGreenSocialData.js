// Fetches social amenities from Overpass and computes analysis scores.
// Runs only when an analysis type is selected — no side effects otherwise.

import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import {
  SOCIAL_AMENITIES_QUERY,
  socialAmenitiesToGeoJSON,
  computeGreenCoverageScores,
  computeSocialDensityScores,
  computeAccessibilityScores,
  computeEncounterPotential,
} from '../utils/greenSocialAnalysis'

const OVERPASS = 'https://overpass-api.de/api/interpreter'

function postOverpass(query) {
  return fetch(OVERPASS, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `data=${encodeURIComponent(query)}`,
  }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
}

export function useGreenSocialData() {
  const {
    greenSocialActiveAnalysis,
    greeneryGeoJSON,
    districtBoundaries,
    transitStopsGeoJSON,
    socialAmenitiesGeoJSON,
    setSocialAmenitiesGeoJSON,
    setSocialAmenitiesLoading,
    setGreenSocialScores,
    setGreenSocialError,
  } = useAppStore()

  // ── Fetch social amenities once when first analysis is selected ──────────────
  useEffect(() => {
    if (!greenSocialActiveAnalysis) return
    if (socialAmenitiesGeoJSON) return  // already cached

    let cancelled = false
    setSocialAmenitiesLoading(true)

    postOverpass(SOCIAL_AMENITIES_QUERY)
      .then(data => {
        if (!cancelled) setSocialAmenitiesGeoJSON(socialAmenitiesToGeoJSON(data.elements || []))
      })
      .catch(err => {
        console.error('Social amenities fetch error:', err)
        // Store empty GeoJSON so we don't retry and the analysis still runs with zero social data
        if (!cancelled) setSocialAmenitiesGeoJSON({ type: 'FeatureCollection', features: [] })
      })
      .finally(() => {
        if (!cancelled) setSocialAmenitiesLoading(false)
      })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greenSocialActiveAnalysis])

  // ── Compute scores (sync) whenever dependencies change ────────────────────
  useEffect(() => {
    if (!greenSocialActiveAnalysis) return
    if (!greeneryGeoJSON || !Object.keys(districtBoundaries).length) return

    // Social/encounter analyses need amenity data
    const needsSocial = greenSocialActiveAnalysis === 'social' || greenSocialActiveAnalysis === 'encounter'
    if (needsSocial && !socialAmenitiesGeoJSON) return

    try {
      let scores = {}
      switch (greenSocialActiveAnalysis) {
        case 'coverage':
          scores = computeGreenCoverageScores(greeneryGeoJSON, districtBoundaries)
          break
        case 'social':
          scores = computeSocialDensityScores(socialAmenitiesGeoJSON, districtBoundaries)
          break
        case 'accessibility':
          scores = computeAccessibilityScores(greeneryGeoJSON, districtBoundaries)
          break
        case 'encounter':
          scores = computeEncounterPotential(
            greeneryGeoJSON,
            socialAmenitiesGeoJSON,
            transitStopsGeoJSON,
            districtBoundaries
          )
          break
        default:
          break
      }
      setGreenSocialScores(scores)
      setGreenSocialError(null)
    } catch (err) {
      console.error('Green social analysis error:', err)
      setGreenSocialError('Analysis computation failed — check the console for details.')
    }
  }, [
    greenSocialActiveAnalysis,
    greeneryGeoJSON,
    socialAmenitiesGeoJSON,
    transitStopsGeoJSON,
    districtBoundaries,
  ])
}
