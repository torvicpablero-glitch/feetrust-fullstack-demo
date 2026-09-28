import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  rotation: number;
  rotSpeed: number;
  shape: 'gem' | 'circle' | 'star';
}

interface CelebrationEventDetail {
  x?: number;
  y?: number;
  count?: number;
}

export function triggerCelebration(detail?: CelebrationEventDetail) {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('feetrust-celebrate', { detail });
    window.dispatchEvent(event);
  }
}

export default function CelebrationFX() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = [
      '#f59e0b', // Amber
      '#6366f1', // Indigo
      '#3b82f6', // Blue
      '#ec4899', // Pink
      '#10b981', // Emerald
      '#fbbf24', // Yellow / Gold
      '#a855f7', // Purple
      '#ffffff', // Sparkle White
    ];

    const createParticles = (originX: number, originY: number, count: number = 60) => {
      const shapes: ('gem' | 'circle' | 'star')[] = ['gem', 'circle', 'star'];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 9;
        particlesRef.current.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 3, // Slight upward boost
          size: 5 + Math.random() * 8,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.015 + Math.random() * 0.015,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.2,
          shape: shapes[Math.floor(Math.random() * shapes.length)],
        });
      }
    };

    const handleCelebrate = (e: Event) => {
      const customEvent = e as CustomEvent<CelebrationEventDetail>;
      const originX = customEvent.detail?.x ?? window.innerWidth / 2;
      const originY = customEvent.detail?.y ?? window.innerHeight / 2;
      const count = customEvent.detail?.count ?? 70;
      createParticles(originX, originY, count);
    };

    window.addEventListener('feetrust-celebrate', handleCelebrate);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (particlesRef.current.length > 0) {
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.22; // Gravity
          p.vx *= 0.98; // Air resistance
          p.rotation += p.rotSpeed;
          p.alpha -= p.decay;

          if (p.alpha <= 0 || p.y > canvas.height + 50) {
            particlesRef.current.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;

          if (p.shape === 'gem') {
            // Diamond / Gem shape
            ctx.beginPath();
            ctx.moveTo(0, -p.size);
            ctx.lineTo(p.size * 0.8, 0);
            ctx.lineTo(0, p.size);
            ctx.lineTo(-p.size * 0.8, 0);
            ctx.closePath();
            ctx.fill();
          } else if (p.shape === 'star') {
            // 4-point star
            ctx.beginPath();
            ctx.moveTo(0, -p.size);
            ctx.lineTo(p.size * 0.25, -p.size * 0.25);
            ctx.lineTo(p.size, 0);
            ctx.lineTo(p.size * 0.25, p.size * 0.25);
            ctx.lineTo(0, p.size);
            ctx.lineTo(-p.size * 0.25, p.size * 0.25);
            ctx.lineTo(-p.size, 0);
            ctx.lineTo(-p.size * 0.25, -p.size * 0.25);
            ctx.closePath();
            ctx.fill();
          } else {
            // Circular sparkle
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('feetrust-celebrate', handleCelebrate);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      aria-hidden="true"
    />
  );
}
