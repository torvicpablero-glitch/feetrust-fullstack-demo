import React from 'react';
import {
  ShoppingCart,
  ShoppingBag,
  UtensilsCrossed,
  Hotel,
  Car,
  Dumbbell,
  Plane,
  Train,
  Fuel,
  Truck,
  GraduationCap,
  BookOpen,
  Building2,
  HeartPulse,
  Stethoscope,
  Landmark,
  Coins,
  ShieldCheck,
  PawPrint,
  Home,
  Wrench,
  CarFront,
  Armchair,
  Hammer,
  Shirt,
  Scissors,
  Sparkles,
  Coffee,
  Film,
  Ticket,
  Dices,
  Gamepad2,
  Briefcase,
  Monitor,
  Headphones,
  Headset,
  Users,
  ShoppingBasket,
  Wine,
  Sprout,
  Factory,
  Package,
  HardHat,
  Trees,
  HeartHandshake,
  MoreHorizontal,
  Building
} from 'lucide-react';

export interface CategoryInfo {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  svgPath: string; // Clean SVG path for Leaflet markers
}

/**
 * Image 2 Category Mapping Engine
 * Matches any category or workplace name to the exact icons from the FeeTrust design spec.
 */
export function getCategoryInfo(categoryStr?: string, nameStr?: string): CategoryInfo {
  const text = `${categoryStr || ''} ${nameStr || ''}`.toLowerCase().trim();

  // 1. Cafés & Quick Service
  if (text.includes('coffee') || text.includes('barista') || text.includes('cafe') || text.includes('café') || text.includes('roaster') || text.includes('starbucks')) {
    return {
      id: 'cafe',
      name: 'Cafés & Quick Service',
      icon: Coffee,
      svgPath: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/>'
    };
  }

  // 2. Restaurants & Dining (Italian Steakhouse, Bistro, etc.)
  if (text.includes('steakhouse') || text.includes('restaurant') || text.includes('dining') || text.includes('italian') || text.includes('bistro') || text.includes('food') || text.includes('waiter') || text.includes('grill') || text.includes('sushi') || text.includes('pizza') || text.includes('harry ca')) {
    return {
      id: 'restaurant',
      name: 'Restaurants & Cafés',
      icon: UtensilsCrossed,
      svgPath: '<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8Z"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/>'
    };
  }

  // 3. Valet & Parking / Auto
  if (text.includes('valet') || text.includes('parking') || text.includes('garage')) {
    return {
      id: 'valet',
      name: 'Valet & Parking',
      icon: Car,
      svgPath: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.7 2 10.8 2 11v5c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>'
    };
  }

  // 4. Hotels & Hospitality
  if (text.includes('hotel') || text.includes('marriott') || text.includes('hilton') || text.includes('hyatt') || text.includes('hospitality') || text.includes('resort') || text.includes('inn') || text.includes('motel')) {
    return {
      id: 'hotel',
      name: 'Hotels & Hospitality',
      icon: Hotel,
      svgPath: '<path d="M10 22v-6.57"/><path d="M12 11h.01"/><path d="M12 7h.01"/><path d="M14 15.43V22"/><path d="M15 16a5 5 0 0 0-6 0"/><path d="M16 11h.01"/><path d="M16 7h.01"/><path d="M8 11h.01"/><path d="M8 7h.01"/><rect x="4" y="2" width="16" height="20" rx="2"/>'
    };
  }

  // 5. Salon & Beauty / Spa
  if (text.includes('salon') || text.includes('hair') || text.includes('barber') || text.includes('stylist') || text.includes('beauty') || text.includes('nails')) {
    return {
      id: 'salon',
      name: 'Salon & Beauty',
      icon: Scissors,
      svgPath: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>'
    };
  }

  // 6. Spas & Wellness
  if (text.includes('spa') || text.includes('massage') || text.includes('wellness') || text.includes('zen')) {
    return {
      id: 'spa',
      name: 'Spas & Wellness',
      icon: Sparkles,
      svgPath: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>'
    };
  }

  // 7. Retail & Stores / Malls
  if (text.includes('retail') || text.includes('store') || text.includes('shop') || text.includes('boutique') || text.includes('mall') || text.includes('target') || text.includes('walmart')) {
    return {
      id: 'retail',
      name: 'Retail & Stores',
      icon: ShoppingCart,
      svgPath: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>'
    };
  }

  // 8. Fashion & Apparel
  if (text.includes('clothing') || text.includes('apparel') || text.includes('fashion') || text.includes('wear') || text.includes('shoes')) {
    return {
      id: 'fashion',
      name: 'Fashion & Apparel',
      icon: Shirt,
      svgPath: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>'
    };
  }

  // 9. Gyms & Fitness
  if (text.includes('gym') || text.includes('fitness') || text.includes('workout') || text.includes('crossfit') || text.includes('athletics')) {
    return {
      id: 'fitness',
      name: 'Gyms & Fitness',
      icon: Dumbbell,
      svgPath: '<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>'
    };
  }

  // 10. Healthcare & Medical
  if (text.includes('clinic') || text.includes('health') || text.includes('doctor') || text.includes('medical') || text.includes('hospital')) {
    return {
      id: 'healthcare',
      name: 'Healthcare & Clinics',
      icon: HeartPulse,
      svgPath: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>'
    };
  }

  // 11. Tech & Electronics
  if (text.includes('tech') || text.includes('electronic') || text.includes('computer') || text.includes('software') || text.includes('apple')) {
    return {
      id: 'tech',
      name: 'Tech & Electronics',
      icon: Monitor,
      svgPath: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>'
    };
  }

  // 12. Grocery & Supermarkets
  if (text.includes('grocery') || text.includes('market') || text.includes('supermarket') || text.includes('produce') || text.includes('whole foods')) {
    return {
      id: 'grocery',
      name: 'Grocery & Supermarkets',
      icon: ShoppingBasket,
      svgPath: '<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8c.9 0 1.8-.7 2-1.6l1.6-7.4"/><path d="M4.5 15.5h15"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>'
    };
  }

  // 13. Banking & Finance
  if (text.includes('bank') || text.includes('finance') || text.includes('wealth') || text.includes('chase') || text.includes('citi')) {
    return {
      id: 'finance',
      name: 'Banking & Finance',
      icon: Landmark,
      svgPath: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>'
    };
  }

  // 14. Entertainment & Venues
  if (text.includes('cinema') || text.includes('theater') || text.includes('movie') || text.includes('entertainment') || text.includes('arena') || text.includes('stadium')) {
    return {
      id: 'entertainment',
      name: 'Entertainment & Venues',
      icon: Film,
      svgPath: '<rect width="20" height="20" x="2" y="2" rx="2.18"/><line x1="7" x2="7" y1="2" y2="22"/><line x1="17" x2="17" y1="2" y2="22"/><line x1="2" x2="22" y1="12" y2="12"/><line x1="2" x2="7" y1="7" y2="7"/><line x1="2" x2="7" y1="17" y2="17"/><line x1="17" x2="22" y1="17" y2="17"/><line x1="17" x2="22" y1="7" y2="7"/>'
    };
  }

  // 15. Transit & Stations
  if (text.includes('transit') || text.includes('station') || text.includes('metro') || text.includes('subway') || text.includes('train')) {
    return {
      id: 'transit',
      name: 'Transit & Stations',
      icon: Train,
      svgPath: '<rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/>'
    };
  }

  // Default / Professional Services
  return {
    id: 'services',
    name: 'Professional Services',
    icon: Building2,
    svgPath: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>'
  };
}

interface CategoryGlassTileProps {
  category?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showAccentBar?: boolean;
}

/**
 * Image 2 Glass Tile Component
 * Premium 3D frosted-glass squircle with crisp navy line iconography and cyan accent bar.
 */
export const CategoryGlassTile: React.FC<CategoryGlassTileProps> = ({
  category,
  name,
  size = 'md',
  className = '',
  showAccentBar = true,
}) => {
  const info = getCategoryInfo(category, name);
  const IconComponent = info.icon;

  const sizeStyles = {
    sm: {
      container: 'w-8 h-8 rounded-xl',
      iconSize: 'w-4 h-4',
      strokeWidth: 1.8,
      accent: 'w-2.5 h-0.5 mt-0.5',
    },
    md: {
      container: 'w-11 h-11 rounded-[14px]',
      iconSize: 'w-5 h-5',
      strokeWidth: 1.8,
      accent: 'w-3.5 h-[2px] mt-0.5',
    },
    lg: {
      container: 'w-14 h-14 rounded-2xl',
      iconSize: 'w-7 h-7',
      strokeWidth: 1.8,
      accent: 'w-5 h-[2.5px] mt-1',
    },
  }[size];

  return (
    <div
      className={`relative shrink-0 flex flex-col items-center justify-center transition-all ${sizeStyles.container} ${className}`}
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, rgba(240, 246, 255, 0.85) 60%, rgba(226, 238, 253, 0.7) 100%)',
        boxShadow:
          '0 2px 8px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04), inset 0 1.5px 1px #ffffff, inset 0 -1px 2px rgba(186, 215, 250, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.9)',
      }}
    >
      {/* Gloss reflection shimmer overlay */}
      <div 
        className="absolute inset-x-1.5 top-0.5 h-[40%] rounded-t-lg pointer-events-none opacity-80"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 100%)'
        }}
      />

      {/* Navy stroke line icon */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <IconComponent
          className={`${sizeStyles.iconSize} text-slate-800 dark:text-slate-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]`}
          strokeWidth={sizeStyles.strokeWidth}
        />
        {showAccentBar && (
          <div
            className={`${sizeStyles.accent} bg-sky-500 rounded-full shadow-[0_1px_2px_rgba(14,165,233,0.4)]`}
          />
        )}
      </div>
    </div>
  );
};

/**
 * Helper to generate Leaflet Marker HTML matching the Image 2 glass squircle tile
 */
export function getGlassTileMarkerHtml(category?: string, name?: string): string {
  const info = getCategoryInfo(category, name);
  return `
    <div style="
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: linear-gradient(180deg, #ffffff 0%, rgba(240, 246, 255, 0.9) 60%, rgba(226, 238, 253, 0.75) 100%);
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.16), 0 1px 3px rgba(15, 23, 42, 0.08), inset 0 1.5px 1px #ffffff;
      border: 1.5px solid rgba(255, 255, 255, 0.95);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
    ">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1e293b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 1px 1px rgba(255,255,255,0.8));">
        ${info.svgPath}
      </svg>
      <div style="width: 14px; height: 2px; background: #0ea5e9; border-radius: 9999px; margin-top: 2px; box-shadow: 0 1px 2px rgba(14,165,233,0.4);"></div>
    </div>
  `;
}
