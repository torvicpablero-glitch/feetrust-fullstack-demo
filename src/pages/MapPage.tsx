import React, { useState, useEffect, useRef } from 'react';
import { useStore, WorkerProfile, BusinessProfile } from '../lib/store';
import { MapPin, Search, Star, LocateFixed, Loader2, Sparkles, Key, QrCode, Building, Award, Heart, DollarSign, CheckCircle2, Zap, ThumbsUp } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
import toast, { Toaster } from 'react-hot-toast';
import { triggerHaptic } from '../lib/haptics';
import { soundEngine } from '../lib/audio';
import { triggerCelebration } from '../components/CelebrationFX';
import BusinessQRModal from '../components/BusinessQRModal';
import WorkerPassportModal from '../components/WorkerPassportModal';
import QRScannerModal from '../components/QRScannerModal';
import ActivityFeed from '../components/ActivityFeed';
import RadialMeritHalo from '../components/RadialMeritHalo';
import { CategoryGlassTile, getGlassTileMarkerHtml } from '../components/CategoryGlassTile';
import { resolvePresetCoordinates } from '../lib/geocoding';
export interface Person {
  id: string;
  name: string;
  position: string;
  distance: string;
  distanceMiles?: number;
  distanceValue: number;
  level: number;
  initials: string;
  lat: number;
  lng: number;
  role?: string;
  category?: string;
  workplace?: string;
  address?: string;
  avatar?: string;
}

const LocateButton = ({ userLocation }: { userLocation: { lat: number, lng: number } | null }) => {
  const map = useMap();

  const handleLocate = () => {
    if (map && userLocation) {
      map.panTo(userLocation);
      map.setZoom(15);
    } else if (!userLocation) {
      toast.error("Location not available. Please allow location access.");
    }
  };

  return (
    <button onClick={handleLocate} className="absolute top-4 left-4 bg-[#1a103c] border border-white/10 rounded-full p-3 shadow-xl z-10 hover:bg-white/10 transition-colors">
      <LocateFixed className="w-5 h-5 text-blue-400" />
    </button>
  );
};

function getDistanceFromLatLonInKm(lat1?: number, lon1?: number, lat2?: number, lon2?: number) {
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || typeof lat2 !== 'number' || typeof lon2 !== 'number' || isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    return 0;
  }
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const res = R * c;
  return isNaN(res) ? 0 : res;
}

export default function MapPage() {
  const { appState, user, updateState, addReview } = useStore();
  const [filter, setFilter] = useState('All');
  const [distanceUnit, setDistanceUnit] = useState<'mi' | 'km'>('mi');
  const [searchQuery, setSearchQuery] = useState('');
  const [geminiSuggestion, setGeminiSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [rating, setRating] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [nearbyPeople, setNearbyPeople] = useState<Person[]>([]);
  const [submittingRating, setSubmittingRating] = useState(false);

  // Modals state
  const [passportWorker, setPassportWorker] = useState<WorkerProfile | null>(null);
  const [showPassportModal, setShowPassportModal] = useState(false);
  const [selectedBusinessForModal, setSelectedBusinessForModal] = useState<BusinessProfile | null>(null);
  const [returnToTeamBiz, setReturnToTeamBiz] = useState<BusinessProfile | null>(null);
  const [showBusinessQrModal, setShowBusinessQrModal] = useState(false);
  const [showQrScannerModal, setShowQrScannerModal] = useState(false);

  // Custom Google Maps Key state
  const [customKey, setCustomKey] = useState<string>(() => {
    return localStorage.getItem('feetrust_gmaps_key') ||
      (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
      (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY ||
      (import.meta as any).env?.GOOGLE_MAPS_PLATFORM_KEY ||
      (import.meta as any).env?.GOOGLE_MAPS_API_KEY ||
      (typeof process !== 'undefined' && process.env ? (process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.GOOGLE_MAPS_KEY) : '') ||
      '';
  });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState(customKey);
  const [gmAuthFailed, setGmAuthFailed] = useState(false);

  useEffect(() => {
    (window as any).gm_authFailure = () => {
      console.warn("Google Maps API Auth Failed. Automatically switching to OpenStreetMap / Leaflet engine...");
      setGmAuthFailed(true);
    };
  }, []);

  const hasValidKey = Boolean(customKey) && customKey !== 'YOUR_API_KEY';
  const useGoogleMaps = hasValidKey && !gmAuthFailed;

  const leafletMapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<any>(null);
  const leafletLayerGroupRef = useRef<any>(null);

  const filters = distanceUnit === 'mi'
    ? ['All', '0.5 mi', '1 mi', '3 mi', '5 mi', '10 mi', '25 mi', '☕ Baristas', '🍽️ Waiters', '💬 Support', '✂️ Stylists']
    : ['All', '500m', '1 km', '3 km', '5 km', '10 km', '25 km', '☕ Baristas', '🍽️ Waiters', '💬 Support', '✂️ Stylists'];

  const handleWorkerClick = (person: Person) => {
    if (person.role === 'Business') {
      const cleanBizName = (person.name || '').toLowerCase().trim();
      const matchedWorkers = (appState.workers || []).filter(
        w => w && (
          (w.workplace && w.workplace.toLowerCase().trim() === cleanBizName) ||
          ((w as any).businessId && person.id && (w as any).businessId === person.id)
        )
      );

      const foundBiz = (appState.businesses || []).find(
        b => b && (b.id === person.id || (b.name && b.name.toLowerCase().trim() === cleanBizName))
      );

      const targetBiz = {
        id: foundBiz?.id || person.id,
        name: foundBiz?.name || person.name,
        category: foundBiz?.category || person.position || 'Business Workplace',
        address: foundBiz?.address || person.address || 'Workplace Location',
        rating: foundBiz?.rating || 5.0,
        avatar: foundBiz?.avatar || person.avatar,
        qrCodeUrl: foundBiz?.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${window.location.origin}/business/${person.id}`,
        workers: matchedWorkers.length > 0 ? matchedWorkers : (foundBiz?.workers || []),
      };

      setSelectedBusinessForModal(targetBiz);
      setShowBusinessQrModal(true);
      return;
    }

    const fullWorker: WorkerProfile = {
      id: person.id,
      name: person.name,
      position: person.position,
      level: person.level,
      initials: person.initials,
      lat: person.lat,
      lng: person.lng,
      role: person.role || 'Worker',
      isAvailable: true,
      workplace: person.workplace,
      address: person.address,
      avatar: person.avatar,
    };
    setPassportWorker(fullWorker);
    setShowPassportModal(true);
  };

  const handleMeritClick = (person: Person) => {
    if (person.role === 'Business') {
      handleWorkerClick(person);
      return;
    }
    setSelectedPerson(person);
    setRating(null);
    setSelectedTags([]);
  };

  // Handle URL deep links for personal worker QR codes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const workerParam = params.get('worker') || params.get('giveMerit');
    if (workerParam && appState.workers?.length) {
      const found = appState.workers.find(w => w.id === workerParam || w.name.toLowerCase().includes(workerParam.toLowerCase()));
      if (found) {
        setSelectedPerson({
          id: found.id,
          name: found.name,
          position: found.position,
          distance: '0.1 km',
          distanceMiles: 0.06,
          distanceValue: 0.1,
          level: found.level,
          initials: found.initials,
          lat: found.lat,
          lng: found.lng,
          role: found.role,
          workplace: found.workplace,
          avatar: found.avatar,
        });
        toast.success(`Opened Merit page for ${found.name}!`);
      }
    }
  }, [appState.workers]);

  useEffect(() => {
    const handleResize = () => {
      if (leafletInstance.current) {
        leafletInstance.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const filteredPeople = nearbyPeople.filter(person => {
    let distanceMatch = true;
    if (filter === '0.5 mi') distanceMatch = (person.distanceMiles ?? 0) <= 0.5;
    else if (filter === '1 mi') distanceMatch = (person.distanceMiles ?? 0) <= 1.0;
    else if (filter === '3 mi') distanceMatch = (person.distanceMiles ?? 0) <= 3.0;
    else if (filter === '5 mi') distanceMatch = (person.distanceMiles ?? 0) <= 5.0;
    else if (filter === '10 mi') distanceMatch = (person.distanceMiles ?? 0) <= 10.0;
    else if (filter === '25 mi') distanceMatch = (person.distanceMiles ?? 0) <= 25.0;
    else if (filter === '500m') distanceMatch = person.distanceValue <= 500;
    else if (filter === '1 km') distanceMatch = person.distanceValue <= 1000;
    else if (filter === '3 km') distanceMatch = person.distanceValue <= 3000;
    else if (filter === '5 km') distanceMatch = person.distanceValue <= 5000;
    else if (filter === '10 km') distanceMatch = person.distanceValue <= 10000;
    else if (filter === '25 km') distanceMatch = person.distanceValue <= 25000;
    else if (filter.includes('Baristas')) distanceMatch = person.position.toLowerCase().includes('barista');
    else if (filter.includes('Waiters')) distanceMatch = person.position.toLowerCase().includes('waiter') || person.position.toLowerCase().includes('service');
    else if (filter.includes('Support')) distanceMatch = person.position.toLowerCase().includes('support');
    else if (filter.includes('Stylists')) distanceMatch = person.position.toLowerCase().includes('stylist');

    let searchMatch = true;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      searchMatch = person.name.toLowerCase().includes(q) ||
        person.position.toLowerCase().includes(q) ||
        (person.workplace && person.workplace.toLowerCase().includes(q)) ||
        (person.address && person.address.toLowerCase().includes(q));
    }
    return distanceMatch && searchMatch;
  });

  const handleSubmitRating = async (overrideTier?: string) => {
    const tierToSubmit = overrideTier || rating;
    if (!user || !selectedPerson || !tierToSubmit) return;
    setSubmittingRating(true);
    try {
      const finalReviewText = selectedTags.length > 0 ? selectedTags.join(', ') : undefined;

      await addReview({
        fromUserId: user.uid,
        fromUserName: appState.profile.displayName || appState.profile.name || user.name || 'Customer',
        toUserId: selectedPerson.id,
        meritType: tierToSubmit,
        tipAmount: 0,
        reviewText: finalReviewText,
      });

      soundEngine.playMeritSuccess();
      triggerCelebration({ count: 80 });

      toast.success(`Merit given to ${selectedPerson.name}! +50 Gems Awarded!`);
      triggerHaptic([40, 30, 40]);
      setTimeout(() => {
        setSelectedPerson(null);
        setSelectedTags([]);
        if (returnToTeamBiz) {
          setSelectedBusinessForModal(returnToTeamBiz);
          setShowBusinessQrModal(true);
          setReturnToTeamBiz(null);
        }
      }, 1200);
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit recognition.', { duration: 5000 });
    } finally {
      setSubmittingRating(false);
    }
  };

  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking');

  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        setLocationStatus(result.state);
        result.onchange = () => {
          setLocationStatus(result.state);
        };
      }).catch(() => {
        setLocationStatus('prompt');
      });
    } else {
      setLocationStatus('prompt');
    }
  }, []);

  useEffect(() => {
    if (locationStatus === 'granted') {
      if (navigator.geolocation) {
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            const newLat = position.coords.latitude;
            const newLng = position.coords.longitude;

            setUserLocation(prev => {
              if (prev && Math.abs(prev.lat - newLat) < 0.0001 && Math.abs(prev.lng - newLng) < 0.0001) {
                return prev;
              }
              return { lat: newLat, lng: newLng };
            });
            setLocationError(null);

            if (user && appState.profile.role === 'Worker' && appState.profile.isAvailable !== false) {
              updateState({ profile: { ...appState.profile, location: { lat: newLat, lng: newLng } } });
            }
          },
          (error) => {
            console.error("Error watching location: ", error);
            setLocationError(error.message);
            if (error.code === 1) setLocationStatus('denied');
          },
          { enableHighAccuracy: true }
        );
        return () => navigator.geolocation.clearWatch(watchId);
      }
    }
  }, [user, appState.profile.role, locationStatus]);

  const requestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationStatus('granted');
        },
        (error) => {
          console.error("Error requesting location: ", error);
          if (error.code === 1) {
            setLocationStatus('denied');
          }
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const [loadingPeople, setLoadingPeople] = useState(true);

  useEffect(() => {
    const defaultCenter = userLocation || { lat: 41.8781, lng: -87.6298 };
    const baseWorkers = appState.workers || [];
    const baseBusinesses = appState.businesses || [];

    // Option A: Strict 1:1 synchronization with Officially Provisioned Businesses
    // Only registered businesses (appState.businesses) are plotted as workplaces.
    const allBusinesses: BusinessProfile[] = [...baseBusinesses];

    // Also include logged-in business profile if not already present
    if (appState.profile?.role === 'Business' && appState.profile?.workplace?.trim()) {
      const pWorkplace = appState.profile.workplace.trim();
      const alreadyExists = allBusinesses.some(
        b => b && ((b.name && b.name.toLowerCase().trim() === pWorkplace.toLowerCase()) || (b.id === appState.profile.uid))
      );
      if (!alreadyExists) {
        allBusinesses.push({
          id: appState.profile.uid || 'biz_user_profile',
          name: pWorkplace,
          category: appState.profile.position || 'Business Workplace',
          address: appState.profile.address || 'Workplace Location',
          rating: 5.0,
          lat: appState.profile.lat ?? appState.profile.location?.lat,
          lng: appState.profile.lng ?? appState.profile.location?.lng,
          avatar: appState.profile.avatar || undefined,
          plan: 'Starter',
          planPrice: '$5 USD / year',
          employeeLimit: 4,
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${window.location.origin}/business/${appState.profile.uid || 'biz_user_profile'}`,
        } as BusinessProfile);
      }
    }

    const businessPins: any[] = [];

    allBusinesses.forEach((b) => {
      if (!b || !b.name) return;
      const lowerName = b.name.toLowerCase().trim();
      // Guard against 'unassigned' or placeholder strings
      if (lowerName === 'unassigned' || lowerName === 'none' || lowerName === 'n/a') return;

      // Sample worker coordinates if the business itself lacks lat/lng
      const sampleWorker = baseWorkers.find(
        w => w && (
          (w.workplace && w.workplace.toLowerCase().trim() === lowerName) ||
          ((w as any).businessId && (w as any).businessId === b.id)
        )
      );

      const preset = resolvePresetCoordinates(b.address || b.name);

      const bLat = typeof b.lat === 'number' && !isNaN(b.lat)
        ? b.lat
        : (typeof b.location?.lat === 'number' && !isNaN(b.location.lat)
          ? b.location.lat
          : (typeof sampleWorker?.lat === 'number' && !isNaN(sampleWorker.lat)
            ? sampleWorker.lat
            : (preset ? preset.lat : defaultCenter.lat)));

      const bLng = typeof b.lng === 'number' && !isNaN(b.lng)
        ? b.lng
        : (typeof b.location?.lng === 'number' && !isNaN(b.location.lng)
          ? b.location.lng
          : (typeof sampleWorker?.lng === 'number' && !isNaN(sampleWorker.lng)
            ? sampleWorker.lng
            : (preset ? preset.lng : defaultCenter.lng)));

      // Avoid duplicate pins
      const exists = businessPins.some(
        bp => bp.id === b.id || (bp.name && bp.name.toLowerCase().trim() === lowerName)
      );
      if (!exists) {
        businessPins.push({
          id: b.id,
          name: b.name,
          position: b.category || 'Business Workplace',
          workplace: b.name,
          address: b.address || 'Workplace Location',
          level: Math.round(b.rating) || 5,
          initials: (b.name || 'BZ').substring(0, 2).toUpperCase(),
          lat: bLat,
          lng: bLng,
          avatar: b.avatar || undefined,
          role: 'Business' as const,
          isAvailable: true,
        });
      }
    });

    // Map ONLY Businesses to the main map dashboard
    const people: Person[] = businessPins.map(w => {
      const safeLat = typeof w.lat === 'number' && !isNaN(w.lat) ? w.lat : defaultCenter.lat;
      const safeLng = typeof w.lng === 'number' && !isNaN(w.lng) ? w.lng : defaultCenter.lng;
      const distKm = getDistanceFromLatLonInKm(
        defaultCenter.lat, defaultCenter.lng,
        safeLat, safeLng
      ) || 0;
      const distMiles = distKm * 0.621371;

      return {
        id: w.id || 'biz_' + Math.random().toString(36).substring(2, 7),
        name: w.name || 'Workplace',
        position: w.position || 'Business Workplace',
        workplace: w.workplace || w.name || 'Workplace',
        address: w.address || 'Workplace Location',
        avatar: w.avatar || undefined,
        distance: distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`,
        distanceMiles: distMiles,
        distanceValue: distKm * 1000,
        level: w.level || 5,
        initials: (w.name || 'BZ').substring(0, 2).toUpperCase(),
        lat: safeLat,
        lng: safeLng,
        role: 'Business'
      };
    });

    people.sort((a, b) => a.distanceValue - b.distanceValue);
    setNearbyPeople(people);
    setLoadingPeople(false);
  }, [userLocation, appState.workers, appState.businesses, appState.profile]);
  // Leaflet Map Initialization for Fallback Mode (Mounted ONCE)
  useEffect(() => {
    if (useGoogleMaps) return;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const initLeaflet = () => {
      if (!leafletMapRef.current || !(window as any).L || leafletInstance.current) return;
      const L = (window as any).L;

      const center = userLocation || { lat: 41.8781, lng: -87.6298 };
      const map = L.map(leafletMapRef.current, { zoomControl: false }).setView([center.lat, center.lng], 14);
      leafletInstance.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      leafletLayerGroupRef.current = L.layerGroup().addTo(map);

      setTimeout(() => {
        if (leafletInstance.current) {
          leafletInstance.current.invalidateSize();
        }
      }, 250);
    };

    const loadLeafletScript = () => {
      if ((window as any).L && leafletMapRef.current) {
        initLeaflet();
      } else {
        const script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => initLeaflet();
        document.body.appendChild(script);
      }
    };

    loadLeafletScript();

    return () => {
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
        leafletLayerGroupRef.current = null;
      }
    };
  }, [useGoogleMaps]);

  // Dynamically update Leaflet Markers WITHOUT destroying map or tiles
  useEffect(() => {
    if (hasValidKey || !leafletInstance.current || !leafletLayerGroupRef.current || !(window as any).L) return;
    const L = (window as any).L;

    // Clear previous markers layer smoothly
    leafletLayerGroupRef.current.clearLayers();

    // User location marker
    if (userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lng === 'number' && !isNaN(userLocation.lat) && !isNaN(userLocation.lng)) {
      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `<div style="background:#06b6d4;width:22px;height:22px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 0 15px #06b6d4;"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(leafletLayerGroupRef.current).bindPopup('You are here');
    }

    // Business markers
    filteredPeople.forEach(person => {
      if (typeof person.lat !== 'number' || typeof person.lng !== 'number' || isNaN(person.lat) || isNaN(person.lng)) {
        return;
      }
      const isBusiness = person.role === 'Business';
      const markerHtml = person.avatar
        ? `<div style="width:44px;height:44px;border-radius:14px;border:2px solid #0ea5e9;box-shadow:0 4px 12px rgba(14,165,233,0.3);overflow:hidden;cursor:pointer;background:#ffffff;"><img src="${person.avatar}" style="width:100%;height:100%;object-fit:cover;" /></div>`
        : isBusiness
          ? getGlassTileMarkerHtml(person.position || person.category, person.name)
          : `<div style="background:linear-gradient(135deg,#06b6d4,#eab308);color:#1a103c;font-weight:bold;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2.5px solid #ffffff;box-shadow:0 4px 15px rgba(0,0,0,0.5);cursor:pointer;font-size:14px;">${person.initials}</div>`;

      const workerIcon = L.divIcon({
        className: 'custom-worker-marker',
        html: markerHtml,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });
      const marker = L.marker([person.lat, person.lng], { icon: workerIcon }).addTo(leafletLayerGroupRef.current);
      marker.on('click', () => handleWorkerClick(person));
    });
  }, [hasValidKey, userLocation, filteredPeople]);

  const saveCustomKey = () => {
    localStorage.setItem('feetrust_gmaps_key', tempKey.trim());
    setCustomKey(tempKey.trim());
    setShowKeyModal(false);
    toast.success("API key saved!");
  };

  const getGeminiSuggestion = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gemini/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: "What are some top verified workplaces near my current location where I can recognize employees?" }),
      });
      const data = await res.json();
      setGeminiSuggestion(data.text);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="w-full flex flex-col md:flex-row gap-4 md:h-full font-['Outfit',sans-serif]">
      <Toaster position="top-center" toastOptions={{ className: 'bg-slate-900 text-white border border-slate-800 shadow-xl' }} />

      {/* Live Camera QR Scanner Modal */}
      <QRScannerModal
        isOpen={showQrScannerModal}
        onClose={() => setShowQrScannerModal(false)}
        onSelectWorker={(w) => handleWorkerClick({
          id: w.id,
          name: w.name,
          position: w.position,
          distance: '0.1 km',
          distanceValue: 100,
          level: w.level,
          initials: w.initials || w.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2),
          lat: w.lat || 41.878,
          lng: w.lng || -87.629,
          workplace: w.workplace
        })}
      />

      {/* Worker Passport Modal */}
      <WorkerPassportModal
        worker={passportWorker}
        isOpen={showPassportModal}
        onClose={() => setShowPassportModal(false)}
        onGiveMerit={() => {
          if (passportWorker) {
            handleMeritClick({
              id: passportWorker.id,
              name: passportWorker.name,
              position: passportWorker.position,
              distance: '0.1 km',
              distanceValue: 100,
              level: passportWorker.level,
              initials: passportWorker.initials,
              lat: passportWorker.lat,
              lng: passportWorker.lng,
              workplace: passportWorker.workplace,
              avatar: passportWorker.avatar,
            });
          }
        }}
      />

      {/* Map Area */}
      <div className="w-full h-78 min-h-78 md:h-full md:min-h-0 flex-1 rounded-2xl md:rounded-3xl overflow-hidden relative border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 shadow-sm shrink-0 z-0">
        {locationStatus === 'prompt' && (
          <div className="absolute inset-0 z-20 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <MapPin className="w-16 h-16 text-amber-500 mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Location Required</h2>
            <p className="text-slate-600 mb-6 max-w-md">We need your location to show nearby workplaces and people you can recognize.</p>
            <button onClick={requestLocation} className="bg-linear-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:opacity-90 transition-opacity">
              Enable Location
            </button>
          </div>
        )}

        {locationStatus === 'denied' && (
          <div className="absolute inset-0 z-20 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-rose-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Location Access Denied</h2>
            <p className="text-slate-600 mb-6 max-w-md">You've denied location access. Please enable it in your browser settings to find people nearby.</p>
            <button onClick={requestLocation} className="bg-slate-100 text-slate-800 border border-slate-200 px-6 py-3 rounded-full font-semibold hover:bg-slate-200 transition-colors">
              Try Again
            </button>
          </div>
        )}

        {useGoogleMaps ? (
          <APIProvider apiKey={customKey} version="weekly">
            <Map
              defaultZoom={14}
              defaultCenter={{ lat: 41.8781, lng: -87.6298 }}
              mapId="DEMO_MAP_ID"
              disableDefaultUI={true}
            >
              <LocateButton userLocation={userLocation} />
              {userLocation && (
                <AdvancedMarker position={userLocation}>
                  {appState.profile.avatar || user?.photoURL ? (
                    <img
                      src={appState.profile.avatar || user?.photoURL || ''}
                      className="w-8 h-8 rounded-full border-2 border-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.8)] object-cover"
                      alt="My Location"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-5 h-5 bg-indigo-600 border-2 border-white rounded-full shadow-[0_0_10px_rgba(79,70,229,0.8)] animate-pulse" />
                  )}
                </AdvancedMarker>
              )}
              {filteredPeople.map(person => (
                <AdvancedMarker
                  key={person.id}
                  position={{ lat: person.lat, lng: person.lng }}
                  onClick={() => handleWorkerClick(person)}
                >
                  {person.avatar ? (
                    <img
                      src={person.avatar}
                      alt={person.name}
                      className="w-11 h-11 rounded-[14px] border-2 border-white shadow-xl object-cover hover:scale-110 transition-transform cursor-pointer"
                    />
                  ) : person.role === 'Business' ? (
                    <div className="hover:scale-110 transition-transform cursor-pointer drop-shadow-md">
                      <CategoryGlassTile category={person.position || person.category} name={person.name} size="md" />
                    </div>
                  ) : (
                    <Pin background={"#4f46e5"} borderColor={"#ffffff"} glyphColor={"#ffffff"} />
                  )}
                </AdvancedMarker>
              ))}
            </Map>
          </APIProvider>
        ) : (
          <div className="w-full h-full min-h-78 relative z-0">
            <div ref={leafletMapRef} className="w-full h-full min-h-78 z-0" />
            <button
              onClick={() => {
                if (userLocation && leafletInstance.current) {
                  leafletInstance.current.setView([userLocation.lat, userLocation.lng], 15);
                } else if (!userLocation) {
                  toast.error("Location not available yet.");
                }
              }}
              className="absolute top-4 left-4 bg-white border border-slate-200 rounded-full p-3 shadow-md z-10 hover:bg-slate-50 transition-colors text-indigo-600"
            >
              <LocateFixed className="w-5 h-5 text-indigo-600" />
            </button>
          </div>
        )}

        {/* Top Floating Controls */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button
            onClick={() => setShowQrScannerModal(true)}
            className="bg-linear-to-r from-blue-600 to-indigo-600 rounded-full py-2.5 px-4 shadow-lg hover:shadow-xl transition-all flex items-center space-x-2 text-xs font-bold text-white cursor-pointer font-mono border border-indigo-400/30"
          >
            <QrCode className="w-4 h-4 text-amber-300" />
            <span>SCAN.QR</span>
          </button>
        </div>

        {geminiSuggestion && (
          <div className="absolute bottom-4 left-4 right-4 crystal-card p-4 rounded-2xl z-10 text-sm shadow-xl crystal-facet">
            <div className="refraction" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1 flex items-center font-bold">
              <Star className="w-3.5 h-3.5 mr-1 fill-indigo-600" /> COALESCENCE // AI ANALYSIS
            </span>
            <p className="text-slate-900 dark:text-slate-100 text-xs font-semibold leading-relaxed">{geminiSuggestion}</p>
          </div>
        )}
      </div>

      {/* FULL-SCREEN PROFILE & MERIT RECOGNITION OVERLAY */}
      {selectedPerson && (
        <div className="fixed inset-0 z-50 merit-overlay-backdrop flex items-center justify-center p-4 md:p-8 overflow-y-auto font-['Outfit',sans-serif] animate-in fade-in zoom-in duration-300">
          <div className="merit-profile-modal strata-card-base rounded-3xl w-full max-w-xl p-6 md:p-8 shadow-2xl relative overflow-hidden my-auto">
            {/* Header Label Bar */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/80 dark:border-slate-800">
              <button
                onClick={() => {
                  setSelectedPerson(null);
                  if (returnToTeamBiz) {
                    setSelectedBusinessForModal(returnToTeamBiz);
                    setShowBusinessQrModal(true);
                    setReturnToTeamBiz(null);
                  }
                }}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs font-bold font-mono cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                <span className="text-base leading-none">←</span>
                <span>{returnToTeamBiz ? 'RETURN TO VIEW TEAM' : 'RETURN TO MAP'}</span>
              </button>
            </div>

            {/* 3D Radial Orbiting Glass Bubble Halo */}
            <div className="flex flex-col items-center justify-center mb-4">
              <RadialMeritHalo
                avatar={selectedPerson.avatar}
                initials={selectedPerson.initials}
                name={selectedPerson.name}
                selectedTier={rating}
                onSelectTier={(tier) => {
                  setRating(tier);
                  handleSubmitRating(tier);
                }}
              />

              {/* Profile Details */}
              <div className="text-center mt-2">
                <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">{selectedPerson.name}</h2>
                <div className="flex items-center justify-center space-x-2 mt-1">
                  <span className="text-sm text-indigo-600 dark:text-cyan-400 font-extrabold font-mono uppercase tracking-wide">{selectedPerson.position}</span>
                  {selectedPerson.level && (
                    <span className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-0.5 rounded-full text-xs font-extrabold border border-amber-300 dark:border-amber-800 font-mono">
                      Lvl {selectedPerson.level}
                    </span>
                  )}
                </div>
                {selectedPerson.workplace && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 font-bold flex items-center justify-center">
                    <Building className="w-4 h-4 mr-1.5 text-slate-400" /> {selectedPerson.workplace}
                  </p>
                )}
                {selectedPerson.address && (
                  <p className="text-xs text-indigo-600 dark:text-cyan-400 mt-1 font-semibold flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 mr-1 text-indigo-600 dark:text-cyan-400" /> {selectedPerson.address}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Side Panel Area */}
      <div className="w-full md:w-78.75 flex flex-col gap-3.5 bg-transparent overflow-y-auto max-h-screen">
        <div className="flex flex-col gap-3.5 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4 sm:p-4.5 rounded-2xl shadow-md text-slate-900 dark:text-slate-100 backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-950 dark:text-slate-100">
                  Nearby Workplaces ({filteredPeople.length})
                </h2>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-2.5">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter lattice by name or workplace..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg py-2 pl-8.5 pr-3 text-[11px] font-semibold text-slate-950 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-800 transition-colors"
              />
            </div>

            {/* Filters Scroll Pills */}
            <div className="flex space-x-1.5 overflow-x-auto pb-1.5 no-scrollbar">
              {filters.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer font-mono ${filter === f
                    ? 'bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Workers List */}
            <div className="space-y-2 mt-2 max-h-64 overflow-y-auto no-scrollbar pr-0.5">
              {filteredPeople.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Building className="w-6 h-6 mx-auto mb-1.5 opacity-40 text-slate-400" />
                  <p className="font-bold text-slate-700 dark:text-slate-300">No workplaces found</p>
                  <p className="text-[10px] mt-0.5">No registered businesses match your filter.</p>
                </div>
              ) : (
                filteredPeople.map(person => (
                <div key={person.id} className="bg-slate-50 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl p-2.5 flex items-center justify-between hover:border-sky-400 dark:hover:border-sky-500 transition-all shadow-2xs hover:shadow-sm group relative overflow-hidden">
                  <div
                    className="flex items-center space-x-2.5 min-w-0 cursor-pointer flex-1 mr-2"
                    onClick={() => {
                      if (leafletInstance.current && typeof person.lat === 'number' && typeof person.lng === 'number') {
                        leafletInstance.current.setView([person.lat, person.lng], 16);
                      }
                      handleWorkerClick(person);
                    }}
                  >
                    {person.avatar ? (
                      <div className="w-11 h-11 rounded-[14px] overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 shadow-xs">
                        <img src={person.avatar} alt={person.name} className="w-full h-full object-cover" />
                      </div>
                    ) : person.role === 'Business' ? (
                      <CategoryGlassTile category={person.position || person.category} name={person.name} size="md" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0 bg-linear-to-tr from-blue-600 to-indigo-600 font-mono">
                        {person.initials}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5">
                        <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-tight truncate">{person.name}</h3>
                        {person.role === 'Business' && (
                          <span className="bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-sky-200 dark:border-sky-800 uppercase font-mono shrink-0">
                            Biz
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold truncate mt-0.5">{person.position}</p>
                      {person.workplace && person.workplace !== person.name && <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">{person.workplace}</p>}

                      {/* Distance Badge */}
                      <div className="flex items-center space-x-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 font-mono">
                        <MapPin className="w-2.5 h-2.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>
                          {distanceUnit === 'mi'
                            ? ((person.distanceMiles ?? 0) < 0.1 ? 'Nearby (<0.1 mi)' : `${(person.distanceMiles ?? 0).toFixed(1)} mi away`)
                            : `${person.distance} away`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {person.role === 'Business' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWorkerClick(person);
                      }}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white px-3 py-1.5 rounded-lg font-bold text-[11px] shadow-xs hover:bg-slate-50 dark:hover:bg-slate-750 hover:border-slate-300 dark:hover:border-slate-600 transition-all flex items-center shrink-0 cursor-pointer"
                    >
                      <Building className="w-3.5 h-3.5 mr-1.5 text-slate-600 dark:text-slate-400" /> View Team
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMeritClick(person);
                      }}
                      className="bg-linear-to-r from-blue-600 to-indigo-600 text-white px-3 py-1.5 rounded-lg font-extrabold text-[11px] shadow-xs hover:opacity-95 transition-opacity flex items-center shrink-0 cursor-pointer"
                    >
                      <Star className="w-3 h-3 mr-1 fill-current text-amber-300" /> Merit
                    </button>
                  )}
                </div>
              )))}
            </div>
          </div>
        </div>
      </div>

      {/* Business Store QR & Team Modal */}
      <BusinessQRModal
        business={selectedBusinessForModal || undefined}
        isOpen={showBusinessQrModal}
        onClose={() => setShowBusinessQrModal(false)}
        onSelectWorker={(w) => {
          setReturnToTeamBiz(selectedBusinessForModal);
          setShowBusinessQrModal(false);
          handleMeritClick({
            id: w.id,
            name: w.name,
            position: w.position,
            distance: '0.1 km',
            distanceMiles: 0.06,
            distanceValue: 0.1,
            level: w.level,
            initials: w.initials,
            lat: w.lat,
            lng: w.lng,
            role: 'Worker',
            workplace: w.workplace || selectedBusinessForModal?.name,
            avatar: w.avatar,
          });
        }}
      />
    </div>
  );
}
