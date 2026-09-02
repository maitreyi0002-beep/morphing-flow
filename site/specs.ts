/**
 * Per-component build instructions, written for another agent to execute.
 * Every number here is the one this kit actually ships, and every "do not"
 * marks a mistake that was made and fixed during the build.
 */

export const SPECS: Record<string, string> = {
  search: `Stage 256 × 48. One Tension group.

SHAPES
• bar — {x:0, y:0, w: barWidth, h:48, rx:24}. Collapsed barWidth = 48 (a
  circle); expanded = 256. Nothing else moves.
• droplet — a circle {x: barWidth + lead - r, y: 24 - r, w: 2r, h: 2r, rx: r}
  riding at the leading edge.

MOTION
One spring on barWidth. Target 256 when open, 48 when closed.
stiffness 200, damping 19.

  barWidth = clamp(spring.position, 48, 256)   // CLAMP IT
  lead     = clamp(velocity * 0.012, -CLEAN_FUSION, +CLEAN_FUSION)
  r        = clamp(abs(velocity) * 0.006, 0, 9)
  showDroplet = velocity > 40

Three things that are each a bug if you skip them:
1. The clamp on barWidth. A spring undershoots on the way back, and an
   undershoot below 48 makes the bar narrower than the icon inside it — the
   icon visibly falls out of its own container. Overshoot at the open end is
   the liquid arriving and should be kept; overshoot past a physical floor is
   a defect.
2. The lead cap is the CLEAN-FUSION gap, not the bridge budget. Past clean
   fusion the neck thins to a hair and you are looking at a second bubble
   sitting beside a bar, which reads as a rendering error.
3. The droplet renders only while EXPANDING. Liquid pulled forward reads as
   surface tension; liquid left behind a shrinking shape reads as debris.

CONTENT LAYER
A 48×48 icon button (magnifier, 1.7px stroke, aria-label, aria-expanded)
pinned to the left of the bar, and an <input> beside it that fades in with
openness = (barWidth - 48) / (256 - 48). Give the input pointer-events:none
until openness > 0.9 so a click near the edge cannot land on an invisible
field, and tabindex={-1} + aria-hidden while collapsed.

Apply a content cross-blur of clamp(abs(velocity) * 0.0022, 0, 2.4) px to the
content layer, sharpening to zero as it settles. Crisp text over a deforming
surface reads as two unrelated layers. Keep it under ~3px or it reads as out
of focus rather than in motion.`,

  dropdown: `Stage 208 wide. Two INDEPENDENT filter groups.

The first version of this made each option its own blob on staggered springs.
It demonstrated necking beautifully and made a bad menu: the spacing becomes
whatever the springs happen to be doing, and one option always ends up
dangling off the trigger. A menu is one surface. Build it that way.

GROUP A — the panel (morph)
• trigger — {x:0, y:0, w:208, h:46, rx: R}
• panel   — {x:(208-w)/2, y: 46 - 20, w, h, rx: min(18, h/2)}

  OVERLAP of 20px, not a gap. Two same-width rects separated by even a few px
  merge into an hourglass: the liquid fills the join but leaves a concave fillet
  at each side. Sinking the panel under the trigger by more than its corner
  radius makes the union one clean card.

One spring vector of three values:
  h → 0 closed, (3 * 42 + 14 + 20) open       stiffness 250, damping 26
  w → 208*0.72 closed, 208 open               stiffness 210, damping 22
  R → 23 (pill) closed, 18 (card) open        stiffness 230, damping 26

  The radius must move. Holding a pill-radius trigger on a pill-radius panel
  through the merge gives two stacked lozenges with a pinch between them.

Rows sit at y = 46 - 20 + 20 + 7 + i*42, on a FIXED pitch. Reveal them with
clamp((h - panelH*0.55) / (panelH*0.45), 0, 1) so they do not appear before
the panel can hold them.

GROUP B — the hover highlight (move)
Its own <filter>, at blur = max(3, blur - 2), fill --tension-highlight, no shadow,
rendered FIRST in the content layer so the labels paint over it. A separate
group is what stops it merging into the panel behind it.

• pill    — {x:0, y: y - stretch/2, w:192, h: 38 + stretch, rx:11}
• droplet — trailing, {x: 96 - r, y: y + 19 + lag - r, w:2r, h:2r, rx:r}

  y spring → row centre, stiffness 300, damping 24
  on spring → 0/1 for fade, stiffness 320, damping 30
  stretch = clamp(abs(vy) * 0.05, 0, 10)
  lag     = clamp(-vy * 0.02, -CLEAN_FUSION, +CLEAN_FUSION)
  r       = clamp(abs(vy) * 0.018, 0, 11)

Park it at the last hovered row and fade out; a highlight that teleports home
on mouse-out undoes the effect. Its opacity goes on the WRAPPER, never on the
shape — a fill below the alpha threshold is erased by the filter entirely.

SEPARATORS
1px hairlines on the CONTENT layer, inset 18px, at each row boundary except
the first. They cannot be surface shapes: a 1px shape inside the filter is erased.
Fade a separator to 0 while either neighbouring row owns the highlight, or it
reads as a crack running through the liquid.`,

  accordion: `Stage 256 wide. One Tension group.

SHAPES
• header — {x:0, y:0, w:256, h:52, rx: R}
• panel  — {x:(256-w)/2, y: 52 - 22, w, h, rx: min(18, h/2)}

  OVERLAP of 22px. See the dropdown note: a gap between two same-width rects
  produces a pinched hourglass, not a card.

MOTION — one spring vector of three:
  h → 0 closed, 154 open                      stiffness 250, damping 25
  w → 256*0.66 closed, 256 open               stiffness 195, damping 20
  R → 26 (pill) closed, 18 (card) open        stiffness 240, damping 28

  Height leads and width follows looser — that lag IS the bulge, and it is
  what makes the panel read as a volume being pushed through an opening
  rather than a box unfolding. Corners are near-critically damped so they
  never wobble.

CONTENT
Header: a button with aria-expanded and a plus icon that rotates to 135°.
Panel: body copy, revealed with

  reveal = clamp((h - 154*0.6) / (154*0.4), 0, 1)

GATE THE REVEAL to the last 40% of travel and give the panel overflow:hidden.
Fading copy linearly with panel height leaves it legible at a third open, so
on the way down the words visibly spill past the liquid edge. Content must
never be the last thing on screen. Translate it up by (1 - reveal) * 10px so
it feels carried by the liquid instead of fading in on top of it, and apply a
content cross-blur of clamp(speed * 0.0025, 0, 3) * (1 - reveal).`,

  tabs: `Stage (tabs × 84) wide. One Tension group, LOW BLUR — this component is
the reason the minimum-shape rule exists.

Blur spreads a thin shape's alpha until its own peak drops below the threshold
and it vanishes completely. A 6px underline does not go subtle at blur 6, it
disappears. Cap blur at 3 for a 6px bar, or raise the bar to 2 × blur.

SHAPES
• bar  — {x:left, y: 44, w: right-left, h:6, rx: 2.5}
         rx 2.5, NOT h/2. A fully rounded 6px bar is a capsule, and a capsule
         reads as a short pill rather than as a rule.
• bead — a circle centred on the active tab, {w:2r, h:2r, rx:r},
         r = clamp(3 + speed * 0.0022, 3, 6.9), overlapping the bar vertically.

Low blur buys a bridge budget of only a few px, so the liquid has to come from
shapes that nearly touch. The bead is that: it rides INSIDE the bar on a
lazier spring (stiffness 130, damping 15), trails during travel, and pulls the
silhouette into a teardrop. The bar alone would just slide.

MOTION — the bar's two edges are on DIFFERENT springs:
  targetLeft  = activeIndex * 84 + 14
  targetRight = (activeIndex + 1) * 84 - 14
  moving right → stiffness [190, 360]   (leading edge stiffer)
  moving left  → stiffness [360, 190]
  damping [23, 23]

The leading edge outruns the trailing one, so the bar elongates in flight and
contracts on arrival. Derive the direction from the INDEX CHANGE (compare
against a ref of the previous index), never from live spring positions —
reading positions during render to pick a config that then feeds those same
positions is a feedback loop.

CONTENT
role="tablist" with role="tab" buttons and aria-selected. The LABELS SIT ON
THE GROUND, not on the liquid — only the indicator is liquid — so colour them
from --field-ink. Colouring them from --tension-ink makes them vanish on a dark
ground. Fill the bar with --tension-accent and give the group no drop shadow.`,

  segmented: `Stage (segments × 80) × 44. One Tension group inside a DOM track.

SHAPES
• pill    — {x: x - stretch/2, y: 4 + squash/2,
             w: 72 + stretch, h: 36 - squash, rx: 13}
• droplet — trailing, {x: x + 36 + lag - r, y: 22 - r, w:2r, h:2r, rx:r}

  rx 13, not h/2. Default every indicator in a family to half its height and
  they all converge on the same lozenge and the set loses its shape language.

MOTION — one spring on the pill's x. Target = activeIndex * 80 + 4,
stiffness 300, damping 23.

  stretch = clamp(abs(v) * 0.010, 0, 13)      // along travel
  squash  = clamp(abs(v) * 0.004, 0, 5)       // across it
  lag     = clamp(-v * 0.02, -CLEAN_FUSION, +CLEAN_FUSION)
  r       = clamp(abs(v) * 0.007, 0, 9)

What the pill gains in width it gives up in height, roughly conserving area —
squash and stretch, driven by live velocity so a two-segment jump deforms more
than a one-segment jump. The droplet trails on the opposite side to travel and
is reabsorbed on arrival; cap it inside the clean-fusion gap so it always
arrives connected.

CONTENT
The track is an ordinary DOM div with a translucent background and an inset
hairline — it is NOT part of the liquid. Buttons carry aria-pressed. The ACTIVE
label sits on the accent liquid (--tension-on-accent); the INACTIVE labels sit on
the ground (--field-ink). Two different surfaces, two different tokens.`,

  chips: `A row of pill chips. One Tension group.

This is the one component in the set where the liquid is not decoration: a run of
adjacent SELECTED chips closes its gaps and fuses into a single mass, so the
silhouette tells you what is grouped before you read a label. Merging that
encodes state earns its place; merging that only looks wet does not.

SHAPES
One rect per chip, {x, y:0, w: measuredWidth, h:40, rx:20}, filled with
--tension-accent when selected and --tension-fill when not. Where a selected chip
meets an unselected one the bridge is drawn from the blurred source, so the
neck carries a blend of both fills — you get the gradient for free.

LAYOUT — anchored, and this is the part that matters:

  gapApart = 22   // > bridge budget → unambiguously separate
  gapFused = max(2, round(CLEAN_FUSION * 0.6))

  // fixed slots, computed once from widths + gapApart; these never change
  baseX[i] = sum of (widths[j] + gapApart) for j < i

  // a chip moves ONLY when fused to its left neighbour, and the offset
  // accumulates along a fused run and RESETS when the run breaks
  offset = 0
  for i in 0..n-1:
    offset = (i > 0 && on[i] && on[i-1]) ? offset - (gapApart - gapFused) : 0
    target[i] = baseX[i] + offset

Do NOT recompute the row from its gaps. That is the obvious implementation and
it shifts every chip to the right of the change, so selecting one chip makes
the whole row lurch — four things moving to express one change reads as a
jolt, not as liquid. With anchoring, the leftmost chip never moves, chips after
a fused run never move, and selecting chip 3 moves chip 3.

MOTION
One spring vector over all x targets, stiffness 200, damping 27 —
NEAR-CRITICALLY DAMPED. Overshoot on a closing gap looks like a collision
rather than a settle.

CONTENT
role="switch" with aria-checked on each chip. Labels sit on the liquid, so
--tension-ink when unselected and --tension-on-accent when selected. In production,
measure real chip widths with a ResizeObserver rather than estimating from
label length.`,
};
