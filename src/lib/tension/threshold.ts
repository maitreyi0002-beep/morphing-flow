/**
 * The surface filter is two operations:
 *
 *   1. feGaussianBlur turns every shape's hard alpha edge into a soft ramp.
 *      Where two shapes are close, their ramps ADD in the overlap.
 *   2. feColorMatrix applies a steep linear curve to alpha and clamps:
 *
 *        alphaOut = contrast * alphaIn + offset
 *
 *      Alpha that summed above the curve's 50% crossing survives as solid;
 *      everything below vanishes. In the gap between two approaching shapes,
 *      the moment the summed alpha crosses that line, a neck snaps into being.
 *
 * So the whole effect is governed by where that crossing sits. Solving
 * `0.5 = contrast * t + offset` for the offset gives us a `threshold` knob
 * in real units (0..1 alpha) instead of the opaque magic number most
 * implementations hardcode.
 *
 * The two knobs are orthogonal, which is the useful part:
 *
 *   threshold — WHERE the surface is. Lower merges more eagerly (liquidier,
 *               fatter necks). Higher keeps shapes apart (tighter, crisper).
 *   contrast  — HOW SHARP the surface is. Higher narrows the transition
 *               band, giving a harder edge. It does not change merge distance.
 *
 * Measured from Jakub Antalik's liquid-liquid, for reference: his standard
 * filter is contrast 18 / offset -7, and his liquid-glass variant is
 * contrast 40 / offset -16.17. Both resolve to threshold ≈ 0.4167 — he holds
 * the surface constant and varies only edge sharpness. The classic liquid
 * filter found all over the web (contrast 19 / offset -9) sits at 0.5.
 */

/** Alpha offset that places the filter's 50% crossing at `threshold`. */
export function tensionOffset(contrast: number, threshold: number): number {
  return Math.round((0.5 - contrast * threshold) * 1000) / 1000;
}

/** The 20-value feColorMatrix that leaves RGB alone and reshapes alpha. */
export function tensionMatrix(contrast: number, threshold: number): string {
  return [
    '1 0 0 0 0',
    '0 1 0 0 0',
    '0 0 1 0 0',
    `0 0 0 ${contrast} ${tensionOffset(contrast, threshold)}`,
  ].join('  ');
}

/**
 * Largest gap between two shapes that still produces a visible neck.
 *
 * Empirical, not analytic — the exact figure depends on both shapes' size,
 * since a small shape has less alpha to contribute. Verified by eye against
 * 44px shapes across blur 2..12 and threshold 0.35..0.55. Treat it as the
 * budget you lay out against, not a guarantee.
 *
 * The practical consequence for layout: necking is a SHORT-RANGE effect.
 * Anything you want to visibly string together has to travel inside this
 * budget — two elements 80px apart will never neck, they will just be two
 * elements.
 *
 * CALIBRATION NOTE. An earlier version of this file used blur * 2.5, which is
 * far too generous and produces detached blobs that read as rendering bugs.
 * liquid-liquid's own documentation gives two usable data points: items 8px
 * apart "barely bridge" at blur 5 and "merge cleanly" at blur 12. That puts
 * the outer limit near 1.6 * blur and clean fusion near 0.7 * blur, and the
 * corrected numbers match what actually renders.
 */
export function bridgeDistance(blur: number, threshold = 0.4167): number {
  return blur * 1.6 * (0.5 / threshold);
}

/**
 * Gap at which two shapes stop reading as two shapes and become one mass with
 * a waist. Use this — not bridgeDistance — whenever the design calls for a
 * permanent merge (an accordion panel extruding from its header, a fused chip
 * run). bridgeDistance is the point at which a neck is merely still visible.
 */
export function cleanMergeGap(blur: number, threshold = 0.4167): number {
  return blur * 0.7 * (0.5 / threshold);
}

/**
 * Minimum dimension a shape can have before the filter destroys it.
 *
 * Blur spreads a thin shape's alpha out until its own peak falls below the
 * threshold, and it disappears entirely. This is the single most common way
 * a liquid component breaks: a 4px underline or a 1px divider silently
 * vanishes the moment the filter is applied.
 *
 * Rule: keep every shape's smallest dimension above this, or lower the blur
 * for that component. A 6px underline needs blur <= 3.
 */
export function minShapeSize(blur: number): number {
  return Math.ceil(blur * 2);
}

/**
 * How far the blur bleeds past the shape bounding box. The SVG filter region
 * must be padded by at least this much or the liquid gets clipped at the edges —
 * the second most common way these components break, and it shows up as a
 * flat razor edge on an otherwise round blob.
 */
export function filterPadding(blur: number): number {
  return Math.ceil(blur * 7);
}
