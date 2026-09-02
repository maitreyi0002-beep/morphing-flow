import { TensionParams } from '../src/lib/tension/Tension';
import {
  tensionOffset,
  bridgeDistance,
  cleanMergeGap,
  minShapeSize,
  filterPadding,
} from '../src/lib/tension/threshold';

/**
 * Builds a self-contained build prompt for one component.
 *
 * The point is that someone can paste this into Claude Code, Cursor, Codex or
 * anything else and get THIS component back, not a vague approximation. So the
 * prompt carries the architecture, the exact filter with resolved numbers, the
 * four numeric guardrails, the component's own geometry and spring constants,
 * and the failure modes worth naming — because every one of those was a bug
 * here first, and an agent that isn't warned will reproduce them.
 *
 * Resolved values come from the page's live controls, so a tuned page copies
 * a prompt that carries the tuning.
 */
export function buildPrompt(
  name: string,
  principle: string,
  p: TensionParams,
  spec: string,
): string {
  const pad = filterPadding(p.blur);
  const offset = tensionOffset(p.contrast, p.threshold);
  const bridge = bridgeDistance(p.blur, p.threshold).toFixed(1);
  const fuse = cleanMergeGap(p.blur, p.threshold).toFixed(1);
  const minShape = minShapeSize(p.blur);

  return `Build a "${name}" UI component with a morphing liquid effect — shapes that merge, neck and separate as they animate.

Stack: React 18 + TypeScript. Styling via CSS custom properties (no Tailwind, no CSS-in-JS). No WebGL, no canvas, no animation library, no other dependencies.

════════════════════════════════════════════════
1. ARCHITECTURE — this part is not optional
════════════════════════════════════════════════

The surface filter multiplies alpha by ~${p.contrast} and clamps. Run text through it and the antialiasing is destroyed; run a focus ring through it and the ring is swallowed by the blob. So the filter NEVER touches content. Build two layers:

  <div style="position:relative; width:W; height:H">
    <svg>                                    ← SHAPE layer
      <defs><filter id="tension">…</filter></defs>
      <g filter="url(#tension)">
        <rect …/> <rect …/>                  ← plain rects mirroring each
      </g>                                     element's box; these merge
    </svg>
    <div style="position:absolute; inset:0">  ← CONTENT layer
      …real buttons / inputs / labels…         transparent background,
    </div>                                     unfiltered, laid over the rects
  </div>

Both layers are derived from the SAME array of shape objects ({x, y, w, h, rx}), so they cannot drift apart. Write the shape array first as pure geometry from state, then position the real DOM over it with a slot helper that reads the same objects. The rects supply every visible surface; the DOM supplies text, icons, hit areas, focus and semantics, and its own background stays transparent.

The <svg> needs overflow:visible, pointer-events:none, aria-hidden="true".

════════════════════════════════════════════════
2. THE FILTER — use these exact values
════════════════════════════════════════════════

<filter id="tension" filterUnits="userSpaceOnUse"
        x="-${pad}" y="-${pad}" width="W+${pad * 2}" height="H+${pad * 2}"
        color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceGraphic" stdDeviation="${p.blur}" result="b"/>
  <feColorMatrix in="b" type="matrix" result="surface"
     values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${p.contrast} ${offset}"/>
  <feComposite in="SourceGraphic" in2="surface" operator="atop"/>
</filter>

Why it works: blur turns each shape's hard alpha edge into a ramp, and where two shapes are close the ramps ADD. The colour matrix applies alphaOut = ${p.contrast} × alphaIn + (${offset}) and clamps, so summed alpha above the curve's 50% crossing becomes solid and everything below vanishes. A neck snaps into being the moment the gap's summed alpha crosses that line.

Do not hardcode the offset. Derive it, so the threshold stays a real number you can reason about:

  offset = 0.5 - contrast * threshold        // threshold here = ${p.threshold.toFixed(4)}

threshold and contrast are ORTHOGONAL and must not be conflated. threshold sets WHERE the surface is (what merges, how fat the necks are). contrast sets HOW SHARP the edge is and changes no merge distance at all. blur sets HOW FAR the surface reaches.

════════════════════════════════════════════════
3. NUMERIC GUARDRAILS at blur ${p.blur}
════════════════════════════════════════════════

• Bridge budget ≈ ${bridge}px — the largest gap that still shows a visible neck.
• Clean fusion ≈ ${fuse}px — the gap below which two shapes read as ONE body.
  Use this one, not the bridge budget, whenever two shapes must look like a
  single mass; at the outer limit the neck is a hair and the pieces look
  detached. (Calibrated from liquid-liquid's note that items 8px apart barely
  bridge at blur 5 and merge cleanly at blur 12.)
• Minimum shape size ≈ ${minShape}px — blur spreads a thinner shape's alpha until
  its own peak drops under the threshold and it VANISHES. Silent failure.
• Filter padding ${pad}px with filterUnits="userSpaceOnUse" and explicit
  x/y/width/height. Skip it and the blob gets a flat razor edge where the
  liquid is clipped.

Two more that are not about numbers:

• FILLS MUST BE OPAQUE. A fill with alpha below the threshold is erased
  outright by feColorMatrix — an rgba(…, 0.13) tint renders as nothing.
  Put opacity on a wrapping element, outside the filter.
• TWO SAME-WIDTH SHAPES NEED AN OVERLAP, NOT A GAP. Bridging a gap between
  rects of equal width leaves a concave fillet on each side — an hourglass
  pinch that reads as a rendering artefact. Sink one under the other by more
  than its corner radius. Gaps are for shapes of different widths, or shapes
  meant to look separate.

════════════════════════════════════════════════
4. MOTION — springs, not CSS transitions
════════════════════════════════════════════════

Write a small requestAnimationFrame spring hook (~40 lines, no library):

  velocity += (stiffness * (target - position) - damping * velocity) * dt
  position += velocity * dt
  // clamp dt to 1/30 so a backgrounded tab does not explode the integrator
  // stop the loop when |target - position| and |velocity| are both < 0.01

It must return VELOCITY as well as position — several effects below are driven by live speed. Use CSS transitions for opacity and colour only.

Three reasons a CSS transition cannot do this job: SVG geometry (x, width, rx) is unevenly animatable as a CSS property across browsers; the liquid stretch requires genuine overshoot that an ease curve cannot produce and a bezier approximation cannot interrupt mid-flight; and velocity is a first-class input here, which transitions do not expose.

Snap straight to target when prefers-reduced-motion: reduce is set.

════════════════════════════════════════════════
5. THIS COMPONENT
════════════════════════════════════════════════

Principle: ${principle}

${spec}

════════════════════════════════════════════════
6. COLOUR TOKENS — three surfaces, not one
════════════════════════════════════════════════

Component text lands on one of three surfaces, and they invert independently of each other AND of the page theme (the liquid usually stays light on a dark page; the ground does not). Reading a label's colour from the wrong one is the most common way this breaks, and it fails silently in exactly one theme/ground combination.

  --tension-fill        the liquid's own colour
  --tension-ink         text ON the liquid
  --tension-accent      the accent liquid
  --tension-on-accent   text ON the accent liquid
  --field-ink       text on the GROUND behind the component

A tab bar's labels are on the ground even though its indicator is liquid. A segmented control's active label is on the accent while its inactive siblings are on the ground. Get this wrong and those labels disappear on a dark ground.

Verify by resolving each label's computed colour, compositing any alpha over the token of the surface it is declared to sit on, and asserting ≥ 3:1 in light theme and dark theme, on a light ground and a dark ground. Do not pixel-sample — a spring loop re-rendering every frame fights the DOM mutation that requires.

════════════════════════════════════════════════
7. ACCESSIBILITY
════════════════════════════════════════════════

The content layer is real DOM, so keep it real: correct semantic elements, correct ARIA (aria-expanded, aria-selected, role="switch"/aria-checked as the component requires), full keyboard operation, and a visible focus ring OUTSIDE the blob (outline-offset ≥ 3px) taking its colour from the surface that element sits on. Anything hidden while collapsed gets tabindex={-1} and aria-hidden.

════════════════════════════════════════════════
8. DELIVERABLE
════════════════════════════════════════════════

Return the component as a single .tsx file plus the CSS it needs, with props for its geometry and an optional override for {blur, contrast, threshold}. Include the spring hook and the threshold maths as small separate modules.

Then verify before handing it back:
  • Screenshot MID-TRANSITION, not at rest — necking is invisible at rest and
    is the entire point. Capture the collapse separately from the expand;
    they fail differently, and collapse is where content spills out of its
    container and springs undershoot past physical limits.
  • Push blur up and confirm no shape silently vanishes.
  • Tab through it: every control focusable, ring outside the blob.
  • Check label contrast in both themes on both grounds.`;
}
