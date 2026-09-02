import React, { createContext, useContext, useId, useMemo } from 'react';
import { tensionMatrix, filterPadding } from './threshold';

export interface TensionShape {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Corner radius. Use h/2 for a pill, w/2 === h/2 for a circle. */
  rx: number;
  fill?: string;
  opacity?: number;
}

export interface TensionParams {
  blur: number;
  contrast: number;
  threshold: number;
}

export const TENSION_DEFAULTS: TensionParams = {
  blur: 6,
  contrast: 18,
  threshold: 0.4167,
};

/**
 * Lets a host (a playground, a theme provider, a docs page) override the
 * filter parameters for everything beneath it. Components still take explicit
 * props, which win — this is the fallback layer.
 */
export interface TensionTuning extends TensionParams {
  /** Multiplier on every shape's corner radius. 0 = square, 1 = as authored. */
  radiusScale: number;
  /** Multiplier on TensionSlot's motion blur. 0 disables the cross-blur. */
  contentBlurScale: number;
}

export const TensionParamsContext = createContext<Partial<TensionTuning>>({});

export function useTensionParams(overrides: Partial<TensionParams> = {}): TensionParams {
  const ctx = useContext(TensionParamsContext);
  return {
    blur: overrides.blur ?? ctx.blur ?? TENSION_DEFAULTS.blur,
    contrast: overrides.contrast ?? ctx.contrast ?? TENSION_DEFAULTS.contrast,
    threshold: overrides.threshold ?? ctx.threshold ?? TENSION_DEFAULTS.threshold,
  };
}

export interface TensionProps extends Partial<TensionParams> {
  /** Stage size. The filter region is padded well beyond this. */
  width: number;
  height: number;
  /** The silhouette. These merge; your real DOM does not. */
  shapes: TensionShape[];
  /** Default fill for shapes that don't set their own. */
  fill?: string;
  /** Drop shadow on the whole merged mass. Applied outside the surface filter. */
  shadow?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * The primitive. Everything else in this kit is a set of shapes plus a set of
 * DOM nodes laid over them.
 *
 * ── The two-layer rule ────────────────────────────────────────────────────
 *
 * The surface filter multiplies alpha by ~18 and clamps. Run text through that
 * and its antialiasing is destroyed — glyph edges go to hard black or vanish.
 * Run a focus ring through it and the ring merges into the blob.
 *
 * So the filter never touches your content. It is applied to an SVG layer of
 * plain rectangles that MIRROR the geometry of your real elements. The real
 * elements — buttons, inputs, labels — sit on top, unfiltered, with
 * transparent backgrounds. They keep their text rendering, their focus
 * states, their semantics, their screen-reader behaviour.
 *
 * This is the same structure the reference implementation uses, and it is
 * what makes the technique shippable rather than a demo.
 */
export function Tension({
  width,
  height,
  shapes,
  fill = 'var(--tension-fill, #fff)',
  shadow = 'var(--tension-shadow, 0 2px 6px rgba(0,0,0,.05)) ',
  blur,
  contrast,
  threshold,
  className,
  style,
  children,
}: TensionProps) {
  const p = useTensionParams({ blur, contrast, threshold });
  const ctxRadius = useContext(TensionParamsContext).radiusScale;

  // useId returns ":r0:" style strings; colons are not valid inside url(#...).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const filterId = `tension-${uid}`;

  const pad = filterPadding(p.blur);
  const matrix = useMemo(
    () => tensionMatrix(p.contrast, p.threshold),
    [p.contrast, p.threshold],
  );

  return (
    <div
      className={className}
      style={{ position: 'relative', width, height, ...style }}
    >
      <svg
        width={width}
        height={height}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          // The blur bleeds past the viewBox; without this it gets clipped
          // and the blob picks up a flat razor edge.
          overflow: 'visible',
          pointerEvents: 'none',
          filter: shadow.trim() ? `drop-shadow(${shadow.trim()})` : undefined,
        }}
        aria-hidden="true"
      >
        <defs>
          <filter
            id={filterId}
            filterUnits="userSpaceOnUse"
            x={-pad}
            y={-pad}
            width={width + pad * 2}
            height={height + pad * 2}
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation={p.blur}
              result="blur"
            />
            <feColorMatrix
              in="blur"
              type="matrix"
              values={matrix}
              result="surface"
            />
            {/* `atop` keeps the original shapes crisp and lets the thresholded
                blur supply only the bridges between them. */}
            <feComposite in="SourceGraphic" in2="surface" operator="atop" />
          </filter>
        </defs>

        <g filter={`url(#${filterId})`}>
          {shapes.map((s, i) => (
            <rect
              key={i}
              x={s.x}
              y={s.y}
              width={Math.max(0, s.w)}
              height={Math.max(0, s.h)}
              rx={Math.min(
                s.rx * (ctxRadius ?? 1),
                Math.max(0, s.w) / 2,
                Math.max(0, s.h) / 2,
              )}
              fill={s.fill ?? fill}
              opacity={s.opacity ?? 1}
            />
          ))}
        </g>
      </svg>

      <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
    </div>
  );
}

/**
 * Positions real DOM exactly over one of the shapes above it.
 *
 * Keeping the two layers in sync by hand is where these components rot: you
 * animate the rect, forget the label, and the text drifts out of its blob.
 * Derive both from the same shape object and that can't happen.
 */
export function TensionSlot({
  shape,
  children,
  style,
  motionBlur = 0,
  ...rest
}: {
  shape: TensionShape;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  /**
   * Cross-blur applied to the content while the liquid underneath is moving,
   * sharpening to zero as it settles. Drive it from spring velocity.
   *
   * This is the fix for text that appears to slide around loose on top of a
   * morphing blob. Crisp text over a deforming surface reads as two unrelated
   * layers; a few pixels of blur while in motion makes the content feel
   * carried BY the liquid. Borrowed from liquid-liquid, which calls the same
   * idea `contentBlur` and defaults it to 7px.
   *
   * Do not stack your own `filter` on the same element.
   */
  motionBlur?: number;
} & React.HTMLAttributes<HTMLDivElement>) {
  const scaledBlur = motionBlur * (useContext(TensionParamsContext).contentBlurScale ?? 1);
  return (
    <div
      {...rest}
      style={{
        position: 'absolute',
        left: shape.x,
        top: shape.y,
        width: Math.max(0, shape.w),
        height: Math.max(0, shape.h),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: scaledBlur > 0.15 ? `blur(${scaledBlur.toFixed(2)}px)` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
