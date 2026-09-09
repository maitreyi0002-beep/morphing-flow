---
name: surface-tension-components
description: Build UI components with a morphing liquid effect — shapes that merge, neck and separate as they animate — using SVG filters over real DOM. Use when someone asks for liquid, blobby, metaball, or morphing components; a search bar that expands from an icon; a menu whose items bud off a trigger; an accordion that extrudes; a liquid tab indicator; chips that fuse when selected; or wants to add this effect to an existing design system. Produces React + TypeScript components styled with CSS custom properties.
---

# Surface tension components

Build components whose shapes merge and separate like a liquid, using an SVG
filter over ordinary DOM. No WebGL, no canvas, no dependencies.

## The one rule you cannot break: two layers

The filter multiplies alpha by ~18 and clamps. Text run through it loses its
antialiasing and turns to mush; focus rings get swallowed into the blob.

So the filter never touches content. Every component is:

```
div (position: relative)
├── <svg>                            ← SHAPE layer
│     <g filter="url(#tension)">
│       <rect> <rect> <rect>         ← plain rects mirroring each element's box
└── <div>/<button>/<input>           ← CONTENT layer
                                       real DOM, transparent background,
                                       unfiltered, laid exactly over the rects
```

The rects supply the visible surface. The DOM supplies text, icons, hit areas,
focus, semantics. Both are driven from the **same shape objects**, so they can
never drift apart.

If you find yourself applying `filter:` to an element that contains text, stop —
you are building the version that looks broken on ship.

## The filter

```
feGaussianBlur   stdDeviation = blur
feColorMatrix    alpha row: 0 0 0 <contrast> <offset>
feComposite      in=SourceGraphic in2=liquid operator="atop"
```

Blur softens each shape's alpha edge into a ramp; where two shapes are close
the ramps add. The colour matrix applies `alphaOut = contrast · alphaIn +
offset` and clamps, so summed alpha above the curve's 50% crossing becomes
solid and everything below vanishes. A neck snaps into being the moment the
gap's summed alpha crosses that line.

Express the crossing as a real number instead of a magic constant:

```ts
offset = 0.5 - contrast * threshold
```

**The two knobs are orthogonal. Never conflate them.**

| Knob | Governs | Lower | Higher |
|---|---|---|---|
| `threshold` | **where** the surface is | merges from further away, fatter necks | shapes stay apart, tighter |
| `contrast` | **how sharp** the surface is | soft, smoky edge | hard edge — *merge distance unchanged* |
| `blur` | **how far** the surface reaches | short range | long range, but destroys thin shapes |

Defaults: `blur 6, contrast 18, threshold 0.4167`. That threshold is measured
from Jakub Antalik's `liquid-liquid` (contrast 18 / offset −7, and his
liquid-glass variant 40 / −16.17 — both resolve to 0.4167). The classic liquid
filter found across the web sits at 0.5, which is noticeably less liquid.

## Six constraints that decide whether it works

1. **Bridge budget ≈ `blur * 1.6`; clean fusion ≈ `blur * 0.7`.** Necking is
   short range. Two elements 80px apart will never neck no matter what you
   tune — they will just be two elements. Lay out against this budget, and use
   the *clean-fusion* figure, not the outer one, whenever you want two shapes
   to read as a single body: at the outer limit the neck is a hair and the
   pieces look detached. (Calibrated from liquid-liquid's own note that items
   8px apart barely bridge at blur 5 and merge cleanly at blur 12.)
2. **Minimum shape size ≈ `blur * 2`.** Blur spreads a thin shape's alpha until
   its own peak drops below the threshold and it disappears entirely. A 6px
   underline caps blur at 3. This is the most common silent failure.
3. **Filter region needs `blur * 7` of padding**, with
   `filterUnits="userSpaceOnUse"` and explicit `x/y/width/height`, plus
   `overflow: visible` on the `<svg>`. Skip it and the blob gets a flat razor
   edge where the liquid is clipped.
4. **Every label sits on one of THREE surfaces — name them and tokenise them
   separately.** Text in these components lands on the liquid (`--tension-fill`),
   on the accent liquid (`--tension-accent`), or on the ground behind the component
   (the field). Those three invert independently of each other and of the page
   theme: the liquid usually stays light on a dark page, the ground does not.

   Deriving a label's colour from the wrong one of the three is the single most
   common way this breaks, and it fails silently in exactly one combination, so
   one screenshot will not find it. In this kit it bit twice — first on-surface text
   read from the page's `--ink` (invisible in dark mode), then tab and inactive
   segment labels read from `--tension-ink` when they actually sit on the ground
   (invisible on a dark ground). Note that a tab bar's *labels* are on the
   ground even though its *indicator* is liquid; a segmented control's active
   label is on the accent while its inactive siblings are on the ground.

   Keep `--tension-ink`, `--tension-on-accent` and `--field-ink` as separate tokens, and
   make the ground an absolute material rather than a theme derivative — a
   "light" ground that follows the theme into darkness takes its ink token with
   it and reintroduces the bug.

   Test it: for each label, resolve its computed colour, composite any alpha
   over the token of the surface it is declared to sit on, and assert the ratio
   across theme × ground. Pixel-sampling is the obvious approach and the wrong
   one here — a spring loop re-rendering every frame fights the DOM mutation you
   need to expose the background.
5. **Fills must be opaque.** The alpha curve thresholds at ~0.42, so a fill
   with alpha below that is erased by `feColorMatrix` — a `rgba(…, 0.13)`
   highlight renders as nothing at all. Use an opaque tint and put opacity on a
   wrapping element, outside the filter.
6. **Two same-width shapes need an OVERLAP, not a gap.** Bridging a gap between
   two rects of equal width leaves a concave fillet on each side: an hourglass
   pinch that reads as a rendering artefact, not a card. Sink one under the
   other by more than its corner radius and the union resolves cleanly. Gaps
   are for shapes of *different* widths, or shapes meant to look separate.

## Animate with springs, not CSS transitions

- SVG geometry (`x`, `width`, `rx`) is unevenly animatable as a CSS property;
  setting attributes from JS works everywhere.
- Tension needs **overshoot**. The stretch in a liquid component is the surface
  lagging and then passing its target. An ease curve cannot do that.
- Several effects need **live velocity** (leading droplet, squash), which a CSS
  transition does not expose.

Snap to target when `prefers-reduced-motion: reduce` is set.

Two rules about springs that are easy to miss:

- **Clamp the physical limits.** A spring undershoots on its way back. If the
  collapsed size of a container is a hard floor — an icon has to fit inside it
  — clamp the rendered value, or the icon visibly falls out of its own
  container. Overshoot at the open end is the liquid arriving; overshoot past a
  physical floor is a bug.
- **Cross-blur the content while the liquid moves** (liquid-liquid's
  `contentBlur`, default 7px), sharpening to zero as it settles. Crisp text over
  a deforming surface reads as two unrelated layers; a few pixels of blur makes
  the content feel carried by the liquid. Keep it modest — past ~3px it reads
  as out of focus rather than in motion.

## Recipes — pick the one the interaction calls for

**Velocity-driven separation** (expanding bar, growing field). A shape that only
grows is not liquid. Add a droplet that leads the moving edge in proportion to
its speed, sized by speed, with its lead clamped to the *clean-fusion* gap —
past that the neck thins to a hair and you are looking at a second bubble next
to a bar. Show it only on the way OUT: liquid pulled forward reads as surface
tension, liquid left behind a shrinking shape reads as debris.

**Stagger creates the neck** (toolbars, radial menus, avatar groups). Identical
springs make items fly out as a rigid block and nothing bridges. Give each item
a softer spring than the one above (`stiffness: items.map((_, i) => 210 - i * 52)`).
Set spacing just *outside* the budget at rest so items are separate when settled
and connected while moving.

Do NOT use this for a menu. Spacing that comes out of a spring is spacing you do
not control, and one option always ends up dangling off the trigger. A menu is
one surface: build it as a permanent merge with rows at a fixed pitch, and spend
the liquid on a travelling hover highlight instead — a `move` effect on its own
filter group, so it never merges into the panel behind it. Separators go on the
content layer; a 1px shape inside the filter is erased (constraint 2).

**Anchored motion** (chips, tag rows, any list that regroups). When selection
changes spacing, do not recompute the row from its gaps — that shifts every
element to the right of the change, and four things moving to express one change
reads as a jolt. Give each item a fixed slot, move an item only when it is fused
to its left-hand neighbour, accumulate that offset along a fused run, and reset
it to zero when the run breaks. Then selecting one chip moves one chip. Damp
these springs near-critically: overshoot on a closing gap looks like a
collision, not a settle.

**Permanent merge** (accordion, extruding panel, dropdown). Overlap the two
shapes (constraint 6) so they are one body at every frame. Two more things this
needs, both of which the first draft got wrong:

- *Corners must move.* Holding both shapes at pill radius through the merge
  gives two stacked lozenges with a pinch. Put the radius on its own spring,
  relaxing from pill (closed) to card (open), so the merged mass resolves into
  a single card. liquid-liquid calls this a corner timeline.
- *Content must not outlive its container.* Fading body copy linearly with
  panel height leaves it legible at a third open, so on collapse the words
  visibly spill past the liquid edge. Gate the reveal to the last ~40% of
  travel. Content should never be the last thing on screen.

**Squash and trailing mass** (segmented control, moving indicator). Stretch
along the direction of travel and thin across it, roughly conserving area,
driven by live velocity so a longer jump deforms more. Add a droplet trailing on
the opposite side, capped at the budget. Default the corner radius to half the
shape's height rather than a full capsule, so every indicator in the family
converges on one lozenge.

**Asymmetric edges** (tab underline). Put the leading and trailing edge on
different springs — leading stiffer — so the shape elongates in flight and
contracts on arrival. Flip which is which based on travel direction, derived
from the index change, never from live positions (that is a feedback loop). A
thin bar has almost no blur budget of its own (constraint 2); ride a small
bead inside it on a lazier spring to carry the liquid read the bar itself
can't afford.

## Procedure

1. **Decide whether the merge means anything.** Merging that encodes state —
   grouped, selected, connected, in progress — earns its place. Merging that
   just looks wet is 2016 Dribbble. If it means nothing, say so and offer the
   plain component.
2. Choose the recipe above that matches the interaction.
3. Pick `blur` from the smallest shape (constraint 2), then check every gap you
   want bridged against the budget (constraint 1). If a gap exceeds it, change
   the layout — do not crank the blur.
4. Write the shape array first, as pure geometry from state.
5. Lay content over it with a slot helper that reads the same shape objects.
6. Style the content layer transparent: it contributes text, focus and hit area
   only.

## Reference implementation

`liquid/threshold.ts` (the maths and the constraint helpers), `liquid/useSprings.ts`
(vector spring with per-index configs and velocity output), `liquid/Tension.tsx` (the
`Tension` container and `TensionSlot`), and six worked components: `TensionSearch`,
`TensionDropdown`, `TensionAccordion`, `TensionTabs`, `TensionSegmented`, `TensionChips`.

## Do not

- Reach for Three.js or WebGL for this. It buys nothing here and costs you every
  element's semantics, focus behaviour and text rendering. WebGL is only worth it
  for true background refraction with chromatic dispersion, which this is not.
- Put liquid on destructive actions, modals or dropdown *containers* — the wobble
  reads as lag, and users read lag as broken.
- Ship a liquid cursor follower.

## Verify before you hand it over

- Screenshot mid-transition, not just at rest — necking is invisible at rest and
  is the entire point. Capture the *collapse* separately from the expand; they
  fail differently, and collapse is where content spills and springs undershoot.
- Toggle dark mode and check on-surface text contrast.
- Push the blur up and confirm no shape silently vanishes.
- Tab through it: every control still focusable, focus ring outside the blob.
