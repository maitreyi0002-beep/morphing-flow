# surface-tension

UI components whose shapes merge, neck and separate like a liquid — built from
one SVG filter laid under ordinary DOM.

No WebGL. No canvas. No runtime dependencies beyond React. The components stay
real DOM throughout, so text renders crisply, focus rings work, and screen
readers see buttons and inputs rather than pixels.

```bash
npm install surface-tension
```

```tsx
import { TensionChips } from 'surface-tension';
import 'surface-tension/tokens.css';

<TensionChips options={['Design', 'Research', 'Motion', 'Systems']} />;
```

---

## How it works

Two layers, driven from one array of shapes.

```
div (position: relative)
├── <svg>                            ← SHAPE layer
│     <g filter="url(#tension)">
│       <rect> <rect> <rect>         ← plain rects mirroring each element's box
└── <div>/<button>/<input>           ← CONTENT layer
                                       real DOM, transparent, unfiltered
```

The filter is two operations:

```
feGaussianBlur   stdDeviation = blur
feColorMatrix    alpha row: 0 0 0 <contrast> <offset>
feComposite      in=SourceGraphic in2=surface operator="atop"
```

Blur turns each shape's hard alpha edge into a ramp, and where two shapes are
close the ramps add. The colour matrix applies `alphaOut = contrast · alphaIn +
offset` and clamps, so summed alpha above the curve's 50% crossing becomes
solid and everything below vanishes. A neck snaps into being the moment the
gap's summed alpha crosses that line.

**The filter never touches your content.** It multiplies alpha by ~18 and
clamps — run text through that and the antialiasing is destroyed; run a focus
ring through it and the ring is swallowed by the blob. So it is applied to
plain rectangles that mirror the geometry of your real elements, and the real
elements sit on top, unfiltered, with transparent backgrounds.

### The threshold, as a real number

Most implementations hardcode two coupled magic constants. Derive the offset
instead and you get a knob you can reason about:

```ts
offset = 0.5 - contrast * threshold;
```

```tsx
import { tensionOffset, tensionMatrix } from 'surface-tension';

tensionOffset(18, 0.4167); // -7.001
```

| Knob | Governs | Lower | Higher |
| --- | --- | --- | --- |
| `threshold` | **where** the surface is | merges from further away, fatter necks | shapes stay apart |
| `contrast` | **how sharp** the edge is | soft | hard — *merge distance unchanged* |
| `blur` | **how far** the surface reaches | short range | long range, destroys thin shapes |

`threshold` and `contrast` are orthogonal. Conflating them is the most common
reason a liquid effect refuses to tune.

Default is `blur 6, contrast 18, threshold 0.4167`. That threshold is measured
from [Jakub Antalik's liquid UI library](https://gooey.jakubantalik.com/), whose
two filters both resolve to it — he holds the surface constant and varies only
edge sharpness. The version of this filter found all over the web sits at 0.5,
which is noticeably less liquid.

---

## Six constraints that decide whether it works

Every one of these was a bug in this repository before it was a rule.

```ts
import {
  bridgeDistance,  // ≈ blur * 1.6 — outer limit of a visible neck
  cleanMergeGap,   // ≈ blur * 0.7 — below this, two shapes read as one body
  minShapeSize,    // ≈ blur * 2   — thinner than this and the shape VANISHES
  filterPadding,   // ≈ blur * 7   — filter region slack, or the blob gets clipped
} from 'surface-tension';
```

1. **Bridge budget ≈ `blur * 1.6`, clean fusion ≈ `blur * 0.7`.** Necking is
   short range — two elements 80px apart will never neck no matter what you
   tune. Use the *clean-fusion* figure whenever two shapes must read as one
   body; at the outer limit the neck is a hair and the pieces look detached.
2. **Minimum shape size ≈ `blur * 2`.** Blur spreads a thin shape's alpha until
   its own peak drops under the threshold and it disappears completely. A 6px
   underline caps blur at 3. Silent failure, and the usual first surprise.
3. **Filter region needs `blur * 7` of padding**, with
   `filterUnits="userSpaceOnUse"`, explicit `x/y/width/height`, and
   `overflow: visible` on the `<svg>`. Skip it and the blob picks up a flat
   razor edge where the filter clips.
4. **Three surfaces, three tokens.** Text lands on the liquid, on the accent
   liquid, or on the ground behind — and those invert independently of each
   other *and* of your page theme. See below.
5. **Fills must be opaque.** A fill with alpha under the threshold is erased
   outright. Put opacity on a wrapping element, outside the filter.
6. **Two same-width shapes need an overlap, not a gap.** Bridging a gap between
   rects of equal width leaves a concave fillet on each side — an hourglass
   pinch that reads as a rendering artefact. Sink one under the other by more
   than its corner radius.

---

## Colour

```css
--tension-fill        /* the liquid itself */
--tension-ink         /* text ON the liquid */
--tension-accent      /* the accent liquid */
--tension-on-accent   /* text ON the accent liquid */
--tension-highlight   /* a travelling highlight surface */
--tension-shadow      /* box-shadow syntax, drawn on the merged silhouette */
--field-ink           /* text on the GROUND behind the component */
```

The trap: a tab bar's **labels** sit on the ground even though its **indicator**
is liquid. A segmented control's active label sits on the accent while its
inactive siblings sit on the ground. Colour any of those from `--tension-ink`
and they disappear on a dark ground — which fails in exactly one theme/ground
combination, so one screenshot will not find it.

`npm test` runs a contrast audit that checks every label against the token of
the surface it is declared to sit on, across light/dark × light/dark ground.

---

## Motion

A ~40-line spring hook, no animation library:

```tsx
const { values, velocities } = useSprings([targetA, targetB], {
  stiffness: [250, 195],   // per-index; the differential is what makes necks
  damping: [25, 20],
});
```

Springs rather than CSS transitions for three reasons: SVG geometry (`x`,
`width`, `rx`) is unevenly animatable as a CSS property across browsers; the
liquid stretch needs genuine overshoot, which no ease curve produces and no
bezier approximation can interrupt mid-flight; and **velocity is a first-class
input** here — the leading droplet and the squash are both driven by live speed,
which a transition does not expose.

`MotionContext` scales tempo and bounce for everything beneath it, preserving
the damping ratio so `speed` changes pace without changing character:

```tsx
<MotionContext.Provider value={{ speed: 1.4, bounce: 0.3 }}>
```

Two rules that are easy to miss:

- **Clamp physical limits.** A spring undershoots on the way back. If a
  collapsed size is a hard floor — an icon has to fit inside it — clamp the
  rendered value, or the icon falls out of its own container.
- **Cross-blur content while the liquid moves**, sharpening to zero as it
  settles. Crisp text over a deforming surface reads as two unrelated layers.
  Keep it under ~3px or it reads as out of focus rather than in motion.

Everything snaps straight to target under `prefers-reduced-motion: reduce`.

---

## Components

| | Principle |
| --- | --- |
| `TensionSearch` | Velocity-driven separation — a droplet runs ahead of the growing edge |
| `TensionDropdown` | One mass, two motions — a panel that extrudes, plus a travelling highlight |
| `TensionAccordion` | Corner timeline — radius relaxes from pill to card through the merge |
| `TensionTabs` | Thin shapes need low blur — the constraint that breaks first attempts |
| `TensionSegmented` | Squash and trailing mass — area roughly conserved, driven by velocity |
| `TensionChips` | Anchored merge — the one where the silhouette carries information |

Each takes an optional `tension={{ blur, contrast, threshold }}` override.

### Building your own

`Tension` is the primitive; `TensionSlot` positions real DOM over one of its
shapes so the two layers cannot drift apart.

```tsx
import { Tension, TensionSlot, type TensionShape } from 'surface-tension';

const pill: TensionShape = { x, y: 0, w: 120, h: 40, rx: 20 };

<Tension width={300} height={40} shapes={[pill, droplet]}>
  <TensionSlot shape={pill} motionBlur={blurWhileMoving}>
    <button className="my-chip">Label</button>
  </TensionSlot>
</Tension>;
```

Write the shape array first, as pure geometry from state. Lay content over it
with `TensionSlot`. Style the content layer transparent — it contributes text,
focus and hit area only.

---

## Does the merge mean anything?

Merging that encodes state — grouped, selected, connected, in progress — earns
its place. Merging that only looks wet is decoration, and on a destructive
action or a modal the wobble reads as lag, which users read as broken.

Of the six components here, the chips are the one where the silhouette carries
information you would otherwise have to read. That is the test worth applying
before any of this reaches a product.

---

## Development

```bash
npm install
npm run dev        # builds site-dist/index.html, rebuilds on change
npm run build      # package + type declarations + site
npm run typecheck
npm test           # contrast audit across theme × ground
```

`src/` is the published package. `site/` is **Morphing Flow**, the monograph, built to a single
self-contained HTML file with React bundled in — no CDN, droppable on any
static host.

## Credit

Filter architecture reverse-engineered from
[Jakub Antalik's liquid UI library](https://gooey.jakubantalik.com/), whose
two-layer approach is what makes this shippable rather than a demo.

MIT.
