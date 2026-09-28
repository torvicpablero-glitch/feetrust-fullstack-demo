import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Clock, Loader2, Navigation } from 'lucide-react';

interface AddressSuggestion {
  displayName: string;
  street: string;
  cityState: string;
  lat?: number;
  lng?: number;
}

const PRESET_ADDRESS_SUGGESTIONS: AddressSuggestion[] = [
  { displayName: '14100 Weber Drive, Huntley, IL', street: '14100 Weber Drive', cityState: 'Huntley, IL 60142', lat: 42.1678, lng: -88.4234 },
  { displayName: '14100 Weber Dr, Huntley, IL', street: '14100 Weber Dr', cityState: 'Huntley, IL 60142', lat: 42.1678, lng: -88.4234 },
  { displayName: '1490 West Lake Street, Roselle, IL', street: '1490 West Lake Street', cityState: 'Roselle, IL 60172', lat: 41.9772, lng: -88.0831 },
  { displayName: '1432 North Yale Avenue, Arlington Heights, IL', street: '1432 North Yale Avenue', cityState: 'Arlington Heights, IL 60004', lat: 42.1002, lng: -87.9823 },
  { displayName: '1427 North Highland Avenue, Arlington Heights, IL', street: '1427 North Highland Avenue', cityState: 'Arlington Heights, IL 60004', lat: 42.0995, lng: -87.9810 },
  { displayName: '1425 Lenox Court, Wheeling, IL', street: '1425 Lenox Court', cityState: 'Wheeling, IL 60090', lat: 42.1389, lng: -87.9250 },
  { displayName: '100 S State St, Chicago, IL', street: '100 S State St', cityState: 'Chicago, IL 60603', lat: 41.8818, lng: -87.6278 },
  { displayName: '1 S State St, Chicago, IL', street: '1 S State St', cityState: 'Chicago, IL 60603', lat: 41.8824, lng: -87.6278 },
  { displayName: '540 N Michigan Ave, Chicago, IL', street: '540 N Michigan Ave', cityState: 'Chicago, IL 60611', lat: 41.8922, lng: -87.6244 },
  { displayName: '233 S Wacker Dr, Chicago, IL', street: '233 S Wacker Dr', cityState: 'Chicago, IL 60606', lat: 41.8789, lng: -87.6359 },
  { displayName: '875 N Michigan Ave, Chicago, IL', street: '875 N Michigan Ave', cityState: 'Chicago, IL 60611', lat: 41.8988, lng: -87.6229 },
  { displayName: '600 E Grand Ave, Chicago, IL', street: '600 E Grand Ave', cityState: 'Chicago, IL 60611', lat: 41.8917, lng: -87.6086 },
  { displayName: '100 W Randolph St, Chicago, IL', street: '100 W Randolph St', cityState: 'Chicago, IL 60601', lat: 41.8845, lng: -87.6310 },
  { displayName: '160 N LaSalle St, Chicago, IL', street: '160 N LaSalle St', cityState: 'Chicago, IL 60601', lat: 41.8850, lng: -87.6325 },
];

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (value: string, latLng?: { lat: number; lng: number }) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export default function AddressAutocompleteInput({
  value,
  onChange,
  placeholder = 'Start typing street address...',
  required = false,
  className = '',
  icon,
}: AddressAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter local & fetch API suggestions as user types
  useEffect(() => {
    const query = value.trim().toLowerCase();
    if (query.length < 1) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    // Smart Tokenized Word Matching (e.g. "14100 weber d" matches "14100 Weber Drive")
    const queryTokens = query.split(/\s+/).filter(Boolean);
    
    const localMatches = PRESET_ADDRESS_SUGGESTIONS.filter(item => {
      const targetStr = item.displayName.toLowerCase();
      // Every query token must match at least a prefix in the target string
      return queryTokens.every(token => targetStr.includes(token));
    });

    setSuggestions(localMatches);
    setIsOpen(true);

    // Live Nominatim API Fetching (with 250ms debounce)
    if (query.length >= 2) {
      setLoading(true);
      const timer = setTimeout(async () => {
        try {
          // Note: DO NOT set custom User-Agent in browser fetch as it triggers browser SecurityError!
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`
          );
          if (res.ok) {
            const data = await res.json();
            const apiItems: AddressSuggestion[] = data.map((item: any) => {
              const road = item.address?.road || item.address?.suburb || item.name || '';
              const houseNumber = item.address?.house_number ? `${item.address.house_number} ` : '';
              const city = item.address?.city || item.address?.town || item.address?.village || 'Chicago';
              const state = item.address?.state || 'IL';
              const postcode = item.address?.postcode ? ` ${item.address.postcode}` : '';
              const streetStr = `${houseNumber}${road}`.trim() || item.display_name.split(',')[0];

              return {
                displayName: `${streetStr}, ${city}, ${state}`,
                street: streetStr,
                cityState: `${city}, ${state}${postcode}`,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
              };
            });

            // Combine local and API matches uniquely
            const combined = [...localMatches];
            apiItems.forEach(api => {
              if (!combined.some(c => c.displayName.toLowerCase() === api.displayName.toLowerCase())) {
                combined.push(api);
              }
            });

            if (combined.length > 0) {
              setSuggestions(combined.slice(0, 6));
              setIsOpen(true);
            }
          }
        } catch (e) {
          // On network failure, retain localMatches
          if (localMatches.length > 0) {
            setSuggestions(localMatches);
            setIsOpen(true);
          }
        } finally {
          setLoading(false);
        }
      }, 250);

      return () => clearTimeout(timer);
    }
  }, [value]);

  // Handle outside clicks to dismiss dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (item: AddressSuggestion) => {
    onChange(item.displayName, item.lat && item.lng ? { lat: item.lat, lng: item.lng } : undefined);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative flex items-center">
        {icon || <MapPin className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-indigo-600 pointer-events-none" />}
        <input
          type="text"
          required={required}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => {
            if (value.trim().length > 0 && suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className={className || "w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-10 text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors text-sm font-medium"}
        />
        {loading && (
          <Loader2 className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-indigo-600 animate-spin" />
        )}
      </div>

      {/* Google Maps Style Autocomplete Dropdown Popup */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-[100] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 divide-y divide-slate-100 max-h-64 overflow-y-auto">
          {suggestions.map((item, index) => (
            <button
              key={index}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur before click fires
                handleSelectSuggestion(item);
              }}
              className="w-full text-left px-4 py-3 hover:bg-indigo-50/80 transition-colors flex items-center space-x-3 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center flex-shrink-0 text-slate-500 group-hover:text-indigo-600 transition-colors">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-950 truncate">
                  {item.street || item.displayName.split(',')[0]}
                </p>
                <p className="text-[11px] text-slate-400 group-hover:text-indigo-600 truncate font-medium">
                  {item.cityState || item.displayName}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
