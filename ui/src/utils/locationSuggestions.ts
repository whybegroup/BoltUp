import { resolveGoogleMapsApiKey } from '../config/googleMaps';

export type LocationSuggestion = {
  id: string;
  /** Full label used when the user picks the suggestion (maps query / storage). */
  label: string;
  /** Primary name (truncated to one line in the UI). */
  name: string;
  /** Full address incl. street number when available (second line). */
  address: string;
  /** Straight-line distance from device when GPS origin was sent. */
  distanceMeters?: number;
};

export type GeoCoords = { lat: number; lon: number };

const PLACES_AUTOCOMPLETE = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACES_DETAILS = 'https://places.googleapis.com/v1';
/** Location bias radius around the device (~50km), same idea as Maps nearby bias. */
const NEAR_RADIUS_METERS = 50_000;

type PlacePrediction = {
  place?: string;
  placeId?: string;
  distanceMeters?: number;
  text?: { text?: string };
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
};

type AutocompleteSuggestion = {
  placePrediction?: PlacePrediction;
};

type AutocompleteResponse = {
  suggestions?: AutocompleteSuggestion[];
  error?: { message?: string; status?: string };
};

/** Formats Places `distanceMeters` for the suggestion row (Maps-style US units). */
export function formatSuggestionDistance(meters: number): string {
  const miles = meters / 1609.344;
  if (miles < 0.1) {
    const feet = Math.max(1, Math.round(meters * 3.28084));
    return `${feet} ft`;
  }
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/** Prefer an address string that includes a street number when possible. */
function resolveAddress(full: string, name: string, secondary: string): string {
  let fromFull = '';
  if (full && name) {
    const fullLower = full.toLowerCase();
    const nameLower = name.toLowerCase();
    if (fullLower.startsWith(nameLower)) {
      fromFull = full.slice(name.length).replace(/^[\s,–—-]+/u, '').trim();
    }
  }
  const candidates = [fromFull, secondary].filter((c) => c.length > 0);
  const withNumber = candidates.find((c) => /\d/.test(c));
  return withNumber || fromFull || secondary || '';
}

function mapPredictions(suggestions: AutocompleteSuggestion[]): LocationSuggestion[] {
  const out: LocationSuggestion[] = [];
  for (let i = 0; i < suggestions.length; i++) {
    const pred = suggestions[i]?.placePrediction;
    if (!pred) continue;

    const full = (pred.text?.text ?? '').trim();
    const name = (pred.structuredFormat?.mainText?.text ?? '').trim() || full;
    const secondary = (pred.structuredFormat?.secondaryText?.text ?? '').trim();
    if (!name && !full) continue;

    const address = resolveAddress(full, name, secondary);
    const label = full || (address ? `${name}, ${address}` : name);
    const item: LocationSuggestion = {
      id: pred.placeId || pred.place || `place-${i}`,
      label,
      name: name || label,
      address,
    };
    if (typeof pred.distanceMeters === 'number' && Number.isFinite(pred.distanceMeters)) {
      item.distanceMeters = pred.distanceMeters;
    }
    out.push(item);
  }
  return out;
}

/** Prefer addresses that include a street number / more structure. */
function addressQuality(s: string): number {
  let score = s.trim().length;
  if (/\d/.test(s)) score += 100;
  if (s.includes(',')) score += 20;
  return score;
}

function pickBestAddress(...candidates: (string | undefined | null)[]): string {
  return (
    candidates
      .map((c) => (c ?? '').trim())
      .filter((c) => c.length > 0)
      .sort((a, b) => addressQuality(b) - addressQuality(a))[0] ?? ''
  );
}

function composeLocationLabel(name: string, address: string, fallback: string): string {
  if (name && address) {
    if (address.toLowerCase().startsWith(name.toLowerCase())) return address;
    return `${name}, ${address}`;
  }
  return fallback || name || address;
}

/**
 * Enrich a Places pick with displayName + formattedAddress (street number included).
 * Keeps autocomplete address/label when Place Details returns a weaker (e.g. city-only) string.
 */
export async function resolvePlaceSuggestionDetails(
  suggestion: LocationSuggestion,
  opts?: { signal?: AbortSignal }
): Promise<LocationSuggestion> {
  const apiKey = resolveGoogleMapsApiKey();
  if (!apiKey) return suggestion;

  const rawId = suggestion.id.trim();
  if (!rawId || rawId.startsWith('place-') || rawId === 'as-entered') return suggestion;

  const resource = rawId.startsWith('places/') ? rawId : `places/${rawId}`;
  try {
    const res = await fetch(`${PLACES_DETAILS}/${resource}`, {
      method: 'GET',
      signal: opts?.signal,
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress',
      },
    });
    if (!res.ok) return suggestion;
    const data = (await res.json()) as {
      displayName?: { text?: string };
      formattedAddress?: string;
      error?: { message?: string };
    };
    const name = (data.displayName?.text ?? '').trim() || suggestion.name;
    const address = pickBestAddress(
      data.formattedAddress,
      suggestion.address,
      // Full autocomplete text often includes street number even when secondary text does not.
      suggestion.label
    );
    const label = composeLocationLabel(name, address, suggestion.label);
    return {
      ...suggestion,
      name,
      address,
      label,
    };
  } catch {
    return suggestion;
  }
}

/**
 * Places Autocomplete (New) — same style as Maps as-you-type suggestions.
 * Returns businesses, POIs, and street/residential addresses. Biases toward
 * GPS when available (relevance + proximity), without a pure distance sort.
 */
export async function searchLocationSuggestions(
  query: string,
  opts?: {
    near?: GeoCoords | null;
    limit?: number;
    signal?: AbortSignal;
  }
): Promise<LocationSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const apiKey = resolveGoogleMapsApiKey();
  if (!apiKey) {
    throw new Error('Missing Google Maps API key (EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)');
  }

  const limit = Math.min(Math.max(opts?.limit ?? 6, 1), 20);
  const near = opts?.near ?? null;

  const body: Record<string, unknown> = {
    input: q,
    languageCode: 'en',
  };

  if (near) {
    body.locationBias = {
      circle: {
        center: { latitude: near.lat, longitude: near.lon },
        radius: NEAR_RADIUS_METERS,
      },
    };
    // Enables distanceMeters in predictions; also strengthens nearby ranking.
    body.origin = { latitude: near.lat, longitude: near.lon };
  }

  const res = await fetch(PLACES_AUTOCOMPLETE, {
    method: 'POST',
    signal: opts?.signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as AutocompleteResponse;
  if (!res.ok) {
    const msg = data.error?.message || `Places lookup failed (${res.status})`;
    throw new Error(msg);
  }

  return mapPredictions(data.suggestions ?? []).slice(0, limit);
}
