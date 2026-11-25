import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Building2,
  Compass,
  ExternalLink,
  Landmark,
  Loader2,
  MapPin,
  Navigation,
  Search,
  Star,
  Wallet,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import type { CurrencyCode } from '../../types/finance';

interface PlaceResultItem {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  rating?: number | null;
  userRatingCount?: number | null;
  isOpen?: boolean | null;
  googleMapsUri?: string | null;
}

const DEFAULT_CENTERS: Record<CurrencyCode, { lat: number; lng: number; city: string; region: string }> = {
  INR: { lat: 12.9716, lng: 77.5946, city: 'Bengaluru', region: 'IN' },
  USD: { lat: 40.7128, lng: -74.006, city: 'New York', region: 'US' },
  EUR: { lat: 50.1109, lng: 8.6821, city: 'Frankfurt', region: 'DE' },
  GBP: { lat: 51.5072, lng: -0.1276, city: 'London', region: 'GB' },
};

const FINANCE_CATEGORIES = [
  { id: 'bank', label: 'Banks', query: 'bank branch', color: '#8B5CF6', icon: Landmark },
  { id: 'atm', label: 'ATMs', query: 'ATM cash machine', color: '#06B6D4', icon: Wallet },
  { id: 'tax', label: 'Tax & CA', query: 'tax consultant chartered accountant', color: '#10B981', icon: Building2 },
  { id: 'advisor', label: 'Advisors', query: 'financial planner wealth advisor', color: '#F59E0B', icon: Compass },
] as const;

function PlaceMarkerItem({
  place,
  selected,
  accentColor,
  onSelect,
  onCloseInfo,
}: {
  place: PlaceResultItem;
  selected: boolean;
  accentColor: string;
  onSelect: () => void;
  onCloseInfo: () => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={place.location}
        title={place.name}
        onClick={onSelect}
        zIndex={selected ? 50 : 10}
      >
        <Pin
          background={selected ? '#7C3AED' : accentColor}
          borderColor={selected ? '#EDE9FE' : '#0F172A'}
          glyphColor="#FFFFFF"
          scale={selected ? 1.25 : 1.0}
        />
      </AdvancedMarker>

      {selected && marker && (
        <InfoWindow anchor={marker} maxWidth={260} onCloseClick={onCloseInfo}>
          <div className="p-1 text-slate-900 space-y-1.5">
            <p className="font-semibold text-sm leading-snug">{place.name}</p>
            {place.address && (
              <p className="text-xs text-slate-600 leading-relaxed">{place.address}</p>
            )}
            <div className="flex items-center gap-2 text-xs text-slate-700 pt-0.5">
              {typeof place.rating === 'number' && (
                <span className="inline-flex items-center gap-1 font-medium tabular-nums">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  {place.rating.toFixed(1)}
                  {typeof place.userRatingCount === 'number'
                    ? ` (${place.userRatingCount})`
                    : ''}
                </span>
              )}
              {typeof place.isOpen === 'boolean' && (
                <span
                  className={`font-semibold ${
                    place.isOpen ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {place.isOpen ? 'Open now' : 'Closed'}
                </span>
              )}
            </div>
            {place.googleMapsUri && (
              <a
                href={place.googleMapsUri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900 pt-1"
              >
                Open in Google Maps
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function NearbyFinanceMapContent({
  defaultCenter,
}: {
  defaultCenter: { lat: number; lng: number; city: string; region: string };
}) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const loadingStatus = useApiLoadingStatus();

  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: defaultCenter.lat,
    lng: defaultCenter.lng,
  });
  const [activeCategory, setActiveCategory] = useState<string>('bank');
  const [searchQuery, setSearchQuery] = useState('');
  const [places, setPlaces] = useState<PlaceResultItem[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasSearchedInitialRef = useRef(false);

  const activeCategoryMeta = useMemo(
    () => FINANCE_CATEGORIES.find((c) => c.id === activeCategory) || FINANCE_CATEGORIES[0],
    [activeCategory]
  );

  const runPlaceSearch = useCallback(
    async (queryText: string, searchCenter: { lat: number; lng: number }) => {
      if (!placesLib) return;
      setSearching(true);
      setErrorMessage(null);

      try {
        const response = await placesLib.Place.searchByText({
          textQuery: queryText,
          fields: [
            'id',
            'displayName',
            'formattedAddress',
            'location',
            'rating',
            'userRatingCount',
            'regularOpeningHours',
            'googleMapsURI',
          ],
          locationBias: {
            center: searchCenter,
            radius: 6000,
          },
          maxResultCount: 12,
        });

        const rawPlaces = response?.places ?? [];
        const mapped: PlaceResultItem[] = [];

        for (const p of rawPlaces) {
          if (!p.location) continue;
          const lat = typeof p.location.lat === 'function' ? p.location.lat() : Number(p.location.lat);
          const lng = typeof p.location.lng === 'function' ? p.location.lng() : Number(p.location.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

          let isOpen: boolean | null = null;
          try {
            if (typeof p.isOpen === 'function') {
              const openVal = await p.isOpen();
              isOpen = typeof openVal === 'boolean' ? openVal : null;
            }
          } catch {
            isOpen = null;
          }

          mapped.push({
            id: p.id || `${lat}_${lng}`,
            name: p.displayName || 'Financial Service',
            address: p.formattedAddress || '',
            location: { lat, lng },
            rating: p.rating ?? null,
            userRatingCount: p.userRatingCount ?? null,
            isOpen,
            googleMapsUri: p.googleMapsURI ?? null,
          });
        }

        setPlaces(mapped);
        setSelectedPlaceId(mapped[0]?.id ?? null);
        if (map && mapped[0]) {
          map.panTo(mapped[0].location);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('429')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setErrorMessage('Unable to fetch nearby financial locations right now. Please try again.');
        setPlaces([]);
      } finally {
        setSearching(false);
      }
    },
    [placesLib, map]
  );

  useEffect(() => {
    if (placesLib && !hasSearchedInitialRef.current) {
      hasSearchedInitialRef.current = true;
      void runPlaceSearch(`${activeCategoryMeta.query} near ${defaultCenter.city}`, center);
    }
  }, [placesLib, activeCategoryMeta.query, defaultCenter.city, center, runPlaceSearch]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Browser geolocation is unavailable on this device.');
      return;
    }
    setLocating(true);
    setErrorMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextCenter = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setCenter(nextCenter);
        if (map) {
          map.panTo(nextCenter);
          map.setZoom(14);
        }
        setLocating(false);
        const query = searchQuery.trim() || activeCategoryMeta.query;
        void runPlaceSearch(query, nextCenter);
      },
      () => {
        setLocating(false);
        setErrorMessage('Location access was denied. You can still search any city or neighborhood.');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleSelectPlace = (place: PlaceResultItem) => {
    setSelectedPlaceId(place.id);
    if (map) {
      map.panTo(place.location);
      map.setZoom(15);
    }
  };

  if (loadingStatus === APILoadingStatus.FAILED || loadingStatus === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="rounded-[18px] border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-800 dark:text-amber-200">
        Unable to initialize Google Maps right now. Please check your Maps configuration or try again later.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Search & Category Controls */}
      <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Financial Services Locator
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Find banks, fee-free ATMs, tax consultants, and financial advisors near you.
            </p>
          </div>

          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={locating}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] hover:border-violet-500/40 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {locating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-cyan-500" />
            )}
            Use My Current Location
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = searchQuery.trim() || `${activeCategoryMeta.query} near ${defaultCenter.city}`;
              void runPlaceSearch(q, center);
            }}
            className="flex-1 flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search e.g. "HDFC ATM Indiranagar" or "CPA near ${defaultCenter.city}"...`}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !placesLib}
              className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            {FINANCE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  disabled={searching || !placesLib}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    const q = searchQuery.trim()
                      ? `${cat.query} ${searchQuery.trim()}`
                      : `${cat.query}`;
                    void runPlaceSearch(q, center);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-violet-600 border-violet-500 text-white shadow-sm shadow-violet-600/20'
                      : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-slate-700 dark:text-slate-300 hover:border-violet-500/40'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {errorMessage && (
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{errorMessage}</p>
        )}
      </div>

      {/* Map + Results Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] overflow-hidden h-[460px] lg:h-[540px] relative">
          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={center}
            defaultZoom={13}
            gestureHandling="greedy"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            {places.map((place) => (
              <PlaceMarkerItem
                key={place.id}
                place={place}
                selected={selectedPlaceId === place.id}
                accentColor={activeCategoryMeta.color}
                onSelect={() => handleSelectPlace(place)}
                onCloseInfo={() => setSelectedPlaceId(null)}
              />
            ))}
          </GoogleMap>
        </div>

        <div className="lg:col-span-4 rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-4 flex flex-col h-[460px] lg:h-[540px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Results ({places.length})
            </h3>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {activeCategoryMeta.label}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 mt-2 pr-1">
            {searching ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
                Searching Google Maps Places...
              </div>
            ) : places.length === 0 ? (
              <div className="py-16 text-center px-4 text-xs text-slate-500 dark:text-slate-400">
                No locations matched your current query. Try searching a broader area or selecting another financial category.
              </div>
            ) : (
              places.map((place) => {
                const isSelected = selectedPlaceId === place.id;
                return (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => handleSelectPlace(place)}
                    className={`w-full text-left py-3 px-2.5 rounded-xl transition-colors ${
                      isSelected
                        ? 'bg-violet-500/10 border border-violet-500/30'
                        : 'hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">
                        {place.name}
                      </p>
                      {typeof place.rating === 'number' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500 shrink-0 tabular-nums">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {place.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {place.address && (
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {place.address}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center justify-between text-[11px]">
                      {typeof place.isOpen === 'boolean' ? (
                        <span
                          className={
                            place.isOpen
                              ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                              : 'text-rose-600 dark:text-rose-400 font-medium'
                          }
                        >
                          {place.isOpen ? 'Open now' : 'Closed'}
                        </span>
                      ) : (
                        <span className="text-slate-400">Hours unavailable</span>
                      )}
                      {place.googleMapsUri && (
                        <a
                          href={place.googleMapsUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 font-semibold hover:underline"
                        >
                          Directions
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <p className="pt-3 border-t border-slate-100 dark:border-white/10 text-[11px] text-slate-400">
            Powered by Google Maps Platform. Subject to{' '}
            <a
              href="https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-300"
            >
              Google Maps End User Terms
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

export function NearbyFinanceMapView() {
  const { settings } = useFinance();
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const defaultCenter = DEFAULT_CENTERS[settings.currency] || DEFAULT_CENTERS.INR;

  if (!mapsApiKey || mapsApiKey === 'MY_GOOGLE_MAPS_API_KEY') {
    return (
      <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-8 text-center space-y-3">
        <div className="w-11 h-11 rounded-2xl bg-violet-500/15 text-violet-500 flex items-center justify-center mx-auto">
          <MapPin className="w-5 h-5" />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Google Maps Key Required
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Google Maps Platform is not configured in this environment yet. Enable Google Maps in AI Studio Settings to search nearby banks, ATMs, and advisors.
        </p>
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={mapsApiKey}
      libraries={['places', 'marker']}
      language="en"
      region={defaultCenter.region}
    >
      <NearbyFinanceMapContent defaultCenter={defaultCenter} />
    </APIProvider>
  );
}
