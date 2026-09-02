import React, { useState } from 'react';
import { Tension, TensionSlot, TensionShape, TensionParams } from '../tension/Tension';
import { useSprings, clamp } from '../tension/useSprings';

/**
 * Accordion.
 *
 * Principle demonstrated: PERMANENT MERGE WITH A CORNER TIMELINE.
 *
 * Header and panel sit inside the clean-merge gap, so they are one body at
 * every frame — the panel doesn't appear below the header, it extrudes out
 * of it.
 *
 * Two things the first version got wrong, both worth stating because they
 * generalise:
 *
 * 1. CORNERS MUST MOVE. Holding both shapes at pill radius while they merge
 *    produces two stacked lozenges with a pinch between them, which reads as
 *    a rendering artefact rather than a card opening. The radius is on its own
 *    spring, relaxing from pill (closed, where the header IS a pill) toward a
 *    card radius (open, where the merged mass IS a card). liquid-liquid calls
 *    this a corner timeline and gives it its own duration for the same reason.
 *
 * 2. TEXT MUST NOT OUTLIVE ITS CONTAINER. Fading body copy linearly with panel
 *    height leaves it legible while the panel is only a third open, so on
 *    collapse the words visibly spill past the liquid edge. The reveal curve
 *    is gated to the last 40% of the opening, and it is asymmetric: content
 *    leaves fast on the way down and arrives late on the way up. Content
 *    should never be the last thing on screen.
 */
export function TensionAccordion({
  width = 256,
  title = 'Filter parameters',
  body = 'Blur sets how far the surface reaches. Threshold sets where the surface is. Contrast only sharpens the edge — it never changes what merges.',
  blur = 7,
  liquid,
}: {
  width?: number;
  title?: string;
  body?: string;
  blur?: number;
  /** Override filter params (used by the tuning playground). */
  liquid?: Partial<TensionParams>;
}) {
  const [open, setOpen] = useState(false);

  const headerH = 52;
  // Same lesson as the dropdown: a gap between two same-width rects merges
  // into a pinched hourglass. Sink the panel up under the header instead, by
  // more than the corner radius, and the union is one clean card.
  const overlap = 22;
  const panelH = 132 + overlap;
  const collapsedW = width * 0.66;

  const pillR = headerH / 2;
  const cardR = 18;

  const { values, velocities } = useSprings(
    [
      open ? panelH : 0,
      open ? width : collapsedW,
      open ? cardR : pillR,
    ],
    // Height leads, width follows a touch looser (that lag is the bulge),
    // corners are near-critically damped so they never wobble.
    { stiffness: [250, 195, 240], damping: [25, 20, 28] },
  );
  const [h, w, rx] = values;
  const speed = Math.abs(velocities[0]) + Math.abs(velocities[1]);

  const header: TensionShape = { x: 0, y: 0, w: width, h: headerH, rx };
  const panel: TensionShape = {
    x: (width - w) / 2,
    y: headerH - overlap,
    w,
    h,
    rx: Math.min(cardR, h / 2),
  };

  // Gated to the last 40% of travel, so the copy is fully gone long before
  // the panel is small enough for it to overflow.
  const reveal = clamp((h - panelH * 0.6) / (panelH * 0.4), 0, 1);

  return (
    <Tension
      width={width}
      height={headerH - overlap + panelH}
      blur={blur}
      {...liquid}
      shapes={h > 1 ? [panel, header] : [header]}
    >
      <TensionSlot
        shape={panel}
        style={{
          alignItems: 'flex-start',
          paddingTop: overlap,
          overflow: 'hidden',
        }}
        motionBlur={clamp(speed * 0.0025, 0, 3) * (1 - reveal)}
      >
        <p
          className="tension-panel-body"
          aria-hidden={!open}
          style={{
            opacity: reveal,
            // Rises into place as the panel fills, so the copy feels carried
            // by the liquid instead of fading in on top of it.
            transform: `translateY(${(1 - reveal) * 10}px)`,
          }}
        >
          {body}
        </p>
      </TensionSlot>

      <TensionSlot shape={header} motionBlur={clamp(speed * 0.002, 0, 2.5)}>
        <button
          type="button"
          className="tension-trigger"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span>{title}</span>
          <Plus open={open} />
        </button>
      </TensionSlot>
    </Tension>
  );
}

function Plus({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
      style={{
        transform: `rotate(${open ? 135 : 0}deg)`,
        transition: 'transform .42s cubic-bezier(.2,.9,.3,1.25)',
      }}
    >
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
