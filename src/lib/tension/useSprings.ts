import { createContext, useContext, useEffect, useRef, useState } from 'react';

export interface MotionScale {
  /** Tempo. 2 = twice as fast, same character. */
  speed: number;
  /** 0..1 overshoot. 0.5 is the tuned default; 0 is critically damped. */
  bounce: number;
}

export const MotionContext = createContext<MotionScale>({ speed: 1, bounce: 0.5 });

/**
 * Scaling that preserves the DAMPING RATIO, so `speed` changes tempo without
 * changing character. For a spring, zeta = damping / (2 * sqrt(stiffness)):
 * multiply stiffness by s^2 and damping by s and zeta is unchanged. Scaling
 * stiffness alone would make every component progressively bouncier as you
 * sped it up, which is why a naive speed slider always feels wrong.
 */
function scaleSpring(stiffness: number, damping: number, m: MotionScale) {
  const s = Math.max(0.1, m.speed);
  const bounceMul = 1.6 - Math.min(1, Math.max(0, m.bounce)) * 1.2;
  return { k: stiffness * s * s, c: damping * s * bounceMul };
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface SpringConfig {
  /**
   * Pull toward the target. Higher = faster.
   * Pass an array to give each index its own value — that per-index
   * difference is how stagger (and therefore necking) is produced.
   */
  stiffness?: number | number[];
  /** Resistance. Lower = more overshoot and wobble. Also per-index. */
  damping?: number | number[];
  /** Below this distance AND velocity, the spring snaps home and stops. */
  epsilon?: number;
}

/**
 * A vector spring driven off requestAnimationFrame.
 *
 * Why a spring instead of a CSS transition, given CSS is cheaper:
 *
 *  1. SVG geometry (`x`, `width`, `rx`) is only animatable as a CSS property
 *     in newer browsers, and support is uneven. Setting attributes from JS
 *     works everywhere.
 *  2. Tension needs OVERSHOOT. The stretch you see in a liquid component is the
 *     surface lagging behind and then passing its target — an ease curve
 *     cannot produce that, and a bezier that approximates it is not
 *     interruptible mid-flight.
 *  3. Velocity is a first-class output here. Several of the components use
 *     current speed to drive deformation (a leading droplet, a vertical
 *     squash), which a CSS transition simply does not expose.
 *
 * Returns positions and per-index velocity. Velocities are in units/second.
 */
export function useSprings(
  targets: number[],
  { stiffness = 200, damping = 20, epsilon = 0.01 }: SpringConfig = {},
): { values: number[]; velocities: number[] } {
  const motion = useContext(MotionContext);
  const [, forceRender] = useState(0);
  const state = useRef<{ pos: number[]; vel: number[] } | null>(null);

  // Re-seed if the vector changes length (e.g. items added to a list).
  if (!state.current || state.current.pos.length !== targets.length) {
    state.current = { pos: targets.slice(), vel: targets.map(() => 0) };
  }

  const raf = useRef(0);
  const last = useRef(0);
  const key = targets.join('|');

  const at = (v: number | number[], i: number) =>
    Array.isArray(v) ? (v[i] ?? v[v.length - 1]) : v;
  const cfgKey = `${JSON.stringify(stiffness)}|${JSON.stringify(damping)}|${motion.speed}|${motion.bounce}`;

  useEffect(() => {
    const step = (now: number) => {
      // Clamp dt so a backgrounded tab doesn't explode the integrator when
      // it resumes with a multi-second frame.
      const dt = Math.min((now - last.current) / 1000, 1 / 30) || 1 / 60;
      last.current = now;

      const s = state.current!;
      let moving = false;

      // Someone who has asked the OS for reduced motion should not be shown a
      // wobbling blob. Snap to target: the component still works, the liquid
      // still merges where geometry says it should, nothing oscillates.
      if (prefersReducedMotion()) {
        for (let i = 0; i < targets.length; i++) {
          s.pos[i] = targets[i];
          s.vel[i] = 0;
        }
        forceRender((n) => n + 1);
        raf.current = 0;
        return;
      }

      for (let i = 0; i < targets.length; i++) {
        const delta = targets[i] - s.pos[i];
        // Semi-implicit Euler: stable enough at these stiffnesses, and one
        // line. Velocity updates first, then feeds position in the same step.
        const { k, c } = scaleSpring(at(stiffness, i), at(damping, i), motion);
        s.vel[i] += (k * delta - c * s.vel[i]) * dt;
        s.pos[i] += s.vel[i] * dt;

        if (Math.abs(delta) > epsilon || Math.abs(s.vel[i]) > epsilon) {
          moving = true;
        } else {
          s.pos[i] = targets[i];
          s.vel[i] = 0;
        }
      }

      forceRender((n) => n + 1);
      raf.current = moving ? requestAnimationFrame(step) : 0;
    };

    last.current = performance.now();
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [key, cfgKey, epsilon]);

  return { values: state.current.pos, velocities: state.current.vel };
}

/** Presets. `bouncy` is the one that reads as liquid; the rest are support. */
export const SPRING = {
  bouncy: { stiffness: 260, damping: 16 },
  smooth: { stiffness: 210, damping: 24 },
  stiff: { stiffness: 420, damping: 30 },
  lazy: { stiffness: 120, damping: 18 },
} satisfies Record<string, SpringConfig>;

export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
