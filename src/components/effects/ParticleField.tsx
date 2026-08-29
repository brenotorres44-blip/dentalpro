import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/themes/ThemeProvider';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
}

const BASE_COUNT = 34;
const LINK_DISTANCE = 132;

/** Converte `#rrggbb` em `r, g, b` para montar rgba() com alfa variável. */
function hexToRgb(hex: string): string {
  const clean = hex.trim().replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return '103, 232, 249';
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/**
 * Poeira de dados do fundo.
 *
 * Um único canvas para toda a tela — 34 partículas em vez de dezenas de nós no
 * DOM, cada um com sua própria animação e camada de composição. O laço para
 * quando a aba perde o foco e não existe sob `prefers-reduced-motion`.
 */
export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const { theme } = useTheme();

  const density = theme.effects.particles;
  const count = Math.round(BASE_COUNT * density);
  const dotRgb = hexToRgb(theme.tokens['hud-bright']);
  const linkRgb = hexToRgb(theme.tokens.hud);

  useEffect(() => {
    // Densidade zero não é "poucas partículas": é não instalar o laço de rAF.
    if (reduced || count <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let particles: Particle[] = [];
    // Retina custa 4× em fill rate; 1,5 já elimina o serrilhado visível.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      const { clientWidth: w, clientHeight: h } = canvas;
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        r: Math.random() * 1.3 + 0.5,
        a: Math.random() * 0.4 + 0.18,
      }));
    };

    const draw = () => {
      if (!running) return;
      const { clientWidth: w, clientHeight: h } = canvas;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${dotRgb}, ${p.a})`;
        ctx.fill();
      }

      // Ligações entre vizinhos — é o que faz parecer rede, não confete.
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist > LINK_DISTANCE) continue;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(${linkRgb}, ${0.13 * (1 - dist / LINK_DISTANCE)})`;
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(draw);
      }
    };

    const onResize = () => {
      resize();
      seed();
    };

    resize();
    seed();
    raf = requestAnimationFrame(draw);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced, count, dotRgb, linkRgb]);

  if (reduced || count <= 0) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-70"
      aria-hidden
    />
  );
}
