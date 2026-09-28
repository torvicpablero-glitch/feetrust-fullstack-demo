import React from 'react';
import { Sparkles, Diamond, Star, Award, Zap } from 'lucide-react';
import { soundEngine } from '../lib/audio';

export interface MeritTierItem {
  level: string;
  emoji: string;
  gems: string;
  gemsCount: number;
  color: string;
  tagline: string;
  glowColor: string;
}

export const DEFAULT_MERIT_TIERS: MeritTierItem[] = [
  { level: 'Good', emoji: '☕', gems: '+50 Gems', gemsCount: 50, color: '#3b82f6', tagline: 'Solid & Reliable', glowColor: 'rgba(59, 130, 246, 0.8)' },
  { level: 'Very Good', emoji: '🌟', gems: '+50 Gems', gemsCount: 50, color: '#6366f1', tagline: 'Great Energy', glowColor: 'rgba(99, 102, 241, 0.8)' },
  { level: 'Excellent', emoji: '💎', gems: '+50 Gems', gemsCount: 50, color: '#06b6d4', tagline: 'Outstanding Craft', glowColor: 'rgba(6, 182, 212, 0.9)' },
  { level: 'Super Star', emoji: '🚀', gems: '+50 Gems', gemsCount: 50, color: '#ec4899', tagline: 'Exceptional Vibe', glowColor: 'rgba(236, 72, 153, 0.9)' },
  { level: 'Legend', emoji: '👑', gems: '+50 Gems', gemsCount: 50, color: '#f59e0b', tagline: 'Mastery & Heroic Service', glowColor: 'rgba(245, 158, 11, 0.95)' },
];

interface RadialMeritHaloProps {
  avatar?: string;
  initials: string;
  name: string;
  selectedTier: string | null;
  onSelectTier: (tier: string) => void;
  meritTiers?: MeritTierItem[];
}

export default function RadialMeritHalo({
  avatar,
  initials,
  name,
  selectedTier,
  onSelectTier,
  meritTiers = DEFAULT_MERIT_TIERS,
}: RadialMeritHaloProps) {
  const radius = 152; // px from center to orb centers
  const centerSize = 380; // outer container bounding box

  // Drag and Drop Mercury Coalescence State
  const [activeDragTier, setActiveDragTier] = React.useState<string | null>(null);
  const [dragPos, setDragPos] = React.useState<{ [key: string]: { x: number; y: number } }>({});
  const [coreScale, setCoreScale] = React.useState(1);
  const dragStartRef = React.useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, level: string) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) { }
    setActiveDragTier(level);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>, level: string, defaultOrbX: number, defaultOrbY: number) => {
    if (activeDragTier !== level || !dragStartRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    setDragPos(prev => ({
      ...prev,
      [level]: { x: deltaX, y: deltaY }
    }));

    // Calculate distance from droplet center to core avatar (0, 0)
    const currentX = defaultOrbX + deltaX;
    const currentY = defaultOrbY + deltaY;
    const dist = Math.sqrt(currentX * currentX + currentY * currentY);

    // Magnetic Viscous Attraction Effect on Avatar Core
    if (dist < 180) {
      const scale = 1 + (180 - dist) / 380;
      setCoreScale(scale);
    } else {
      setCoreScale(1);
    }

    // Coalesce / Absorb threshold
    if (dist < 68) {
      soundEngine.playClick();
      onSelectTier(level);
      setCoreScale(1.35);
      setTimeout(() => setCoreScale(1), 300);

      // Release capture & snap back
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) { }
      setActiveDragTier(null);
      dragStartRef.current = null;
      setDragPos(prev => ({ ...prev, [level]: { x: 0, y: 0 } }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>, level: string) => {
    if (activeDragTier === level) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) { }
      setActiveDragTier(null);
      dragStartRef.current = null;
      setCoreScale(1);

      // Smoothly animate back to orbital position
      setDragPos(prev => ({
        ...prev,
        [level]: { x: 0, y: 0 }
      }));
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center my-2 select-none">
      {/* Outer Halo Interactive Container */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: `${centerSize}px`, height: `${centerSize}px` }}
      >
        {/* Ambient Ring Glow Behind Orbit */}
        <div
          className="absolute inset-8 rounded-full pointer-events-none opacity-45 blur-3xl transition-all duration-700"
          style={{
            background: selectedTier
              ? meritTiers.find(t => t.level === selectedTier)?.glowColor || 'rgba(99, 102, 241, 0.4)'
              : 'rgba(245, 158, 11, 0.25)'
          }}
        />

        {/* Central Frosted Glass Halo Connecting Ring */}
        <div
          className="absolute rounded-full pointer-events-none border-[3.5px] border-white/80 dark:border-white/40 shadow-[0_0_25px_rgba(255,255,255,0.4),inset_0_0_15px_rgba(255,255,255,0.3)] transition-all duration-500"
          style={{
            width: `${radius * 2}px`,
            height: `${radius * 2}px`,
            boxShadow: selectedTier
              ? `0 0 30px ${meritTiers.find(t => t.level === selectedTier)?.glowColor || 'rgba(255,255,255,0.5)'}, inset 0 0 20px rgba(255,255,255,0.5)`
              : '0 0 22px rgba(255,255,255,0.4), inset 0 0 15px rgba(255,255,255,0.3)'
          }}
        />

        {/* Inner Portrait Avatar Container (Substantially Bigger 190px Profile Picture) */}
        <div
          className="relative rounded-full overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800 transition-transform duration-200 z-10"
          style={{
            width: '190px',
            height: '190px',
            transform: `scale(${coreScale})`,
            boxShadow: coreScale > 1.05
              ? '0 0 50px rgba(99, 102, 241, 0.8), inset 0 0 30px rgba(255, 255, 255, 0.7)'
              : '0 20px 45px rgba(0,0,0,0.35)',
          }}
        >
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              className="w-full h-full object-cover pointer-events-none"
            />
          ) : (
            <div className="w-full h-full bg-linear-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center text-5xl font-black font-mono">
              {initials}
            </div>
          )}

          {/* Avatar Glass Specular Rim Highlight */}
          <div className="absolute inset-0 rounded-full pointer-events-none border border-white/40 shadow-[inset_0_2px_6px_rgba(255,255,255,0.6)]" />
        </div>

        {/* 5 Orbiting Draggable 3D Volumetric Glass Spheres */}
        {meritTiers.map((tier, index) => {
          const angleDeg = (index * 360) / meritTiers.length - 90;
          const angleRad = (angleDeg * Math.PI) / 180;
          const orbX = Math.cos(angleRad) * radius;
          const orbY = Math.sin(angleRad) * radius;
          const isSelected = selectedTier === tier.level;
          const currentOffset = dragPos[tier.level] || { x: 0, y: 0 };
          const isDragging = activeDragTier === tier.level;
          const orbSize = 76; // 76px ultra-spherical 3D globes

          return (
            <button
              key={tier.level}
              type="button"
              onClick={() => {
                if (!isDragging && (currentOffset.x === 0 && currentOffset.y === 0)) {
                  soundEngine.playClick();
                  onSelectTier(tier.level);
                }
              }}
              onPointerDown={(e) => handlePointerDown(e, tier.level)}
              onPointerMove={(e) => handlePointerMove(e, tier.level, orbX, orbY)}
              onPointerUp={(e) => handlePointerUp(e, tier.level)}
              onPointerCancel={(e) => handlePointerUp(e, tier.level)}
              title={`Drag to center avatar or click: ${tier.emoji} ${tier.level}`}
              aria-label={`Drag or click ${tier.level} merit recognition level`}
              className={`absolute flex flex-col items-center justify-center rounded-full cursor-grab active:cursor-grabbing outline-none select-none ${isDragging ? 'z-40 transition-none scale-110 shadow-2xl' : 'transition-all duration-300 z-20 group'
                } ${isSelected && !isDragging
                  ? 'scale-120 z-30 ring-4 ring-amber-400 dark:ring-amber-300 shadow-[0_0_35px_rgba(245,158,11,0.9)]'
                  : 'hover:scale-110'
                }`}
              style={{
                width: `${orbSize}px`,
                height: `${orbSize}px`,
                left: `calc(50% + ${orbX}px - ${orbSize / 2}px)`,
                top: `calc(50% + ${orbY}px - ${orbSize / 2}px)`,
                transform: `translate3d(${currentOffset.x}px, ${currentOffset.y}px, 0)`,
                touchAction: 'none',
                background: isSelected
                  ? 'radial-gradient(circle at 32% 22%, rgba(255, 255, 255, 0.98) 0%, rgba(254, 243, 199, 0.92) 28%, rgba(245, 158, 11, 0.85) 65%, rgba(180, 83, 9, 0.95) 100%)'
                  : 'radial-gradient(circle at 32% 22%, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.75) 26%, rgba(255, 255, 255, 0.22) 58%, rgba(241, 245, 249, 0.5) 82%, rgba(203, 213, 225, 0.9) 100%)',
                backdropFilter: 'blur(20px) saturate(220%)',
                WebkitBackdropFilter: 'blur(20px) saturate(220%)',
                border: isSelected ? '2.5px solid #ffffff' : '2px solid rgba(255, 255, 255, 0.95)',
                boxShadow: isSelected
                  ? 'inset 0 4px 8px rgba(255, 255, 255, 1), inset 0 -6px 14px rgba(0, 0, 0, 0.4), 0 14px 32px rgba(245, 158, 11, 0.65)'
                  : 'inset 0 4px 8px rgba(255, 255, 255, 0.95), inset 0 -6px 14px rgba(0, 0, 0, 0.3), 0 14px 30px rgba(0, 0, 0, 0.22)',
              }}
            >
              {/* 3D Glass Specular Reflection Crescent Shine */}
              <div
                className="absolute top-2 left-3.5 w-6 h-3 rounded-full pointer-events-none opacity-95"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0) 80%)',
                  transform: 'rotate(-25deg)',
                  filter: 'blur(0.5px)',
                }}
              />

              {/* Bottom Rim Specular Refraction Arc */}
              <div
                className="absolute bottom-1.5 right-3 w-5 h-2 rounded-full pointer-events-none opacity-70"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0) 80%)',
                  transform: 'rotate(25deg)',
                }}
              />

              {/* Emoji Icon inside Glass Sphere */}
              <span className={`text-2xl leading-none transition-transform duration-200 drop-shadow-sm ${isSelected ? 'scale-115 animate-bounce' : 'group-hover:scale-110'}`}>
                {tier.emoji}
              </span>

              {/* Monochromatic Spherical Text Label */}
              <span className={`text-[9.5px] font-black tracking-tight leading-none mt-1 font-mono uppercase transition-colors drop-shadow-xs ${isSelected
                ? 'text-slate-950 font-black'
                : 'text-slate-800 dark:text-slate-900 font-extrabold'
                }`}>
                {tier.level.replace(' ', '')}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Active Tier Selector Badge & Interactive Instruction */}
      <div className="mt-3 flex items-center justify-center">
        {selectedTier ? (
          <div className="flex items-center space-x-2 px-4 py-2 rounded-2xl bg-linear-to-r from-amber-500/15 via-indigo-500/15 to-purple-500/15 border border-amber-300/60 dark:border-amber-700/60 backdrop-blur-md shadow-xs animate-in zoom-in duration-200">
            <span className="text-xl">
              {meritTiers.find(t => t.level === selectedTier)?.emoji}
            </span>
            <div className="flex flex-col text-left">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 font-mono">
                  {selectedTier} Level Selected
                </span>
                <span className="text-[10px] font-extrabold font-mono bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                  +50 Gems
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {meritTiers.find(t => t.level === selectedTier)?.tagline}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs font-extrabold text-slate-600 dark:text-slate-300 font-mono flex items-center animate-pulse">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
            Drag drops to center or click to fuse merit
          </p>
        )}
      </div>
    </div>
  );
}
