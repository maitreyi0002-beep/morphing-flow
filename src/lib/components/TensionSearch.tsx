import React, { useState } from 'react';
import { Tension, TensionSlot, TensionShape, TensionParams } from '../tension/Tension';
import { useSprings, clamp } from '../tension/useSprings';
import { cleanMergeGap } from '../tension/threshold';

/**
 * Search: icon → full bar.
 *
 * Principle demonstrated: VELOCITY-DRIVEN SEPARATION.
 *
 * A single rectangle growing in width is not liquid — it is just a rectangle
 * growing in width. The liquid read comes from a second shape, a droplet,
 * that runs ahead of the growing edge in proportion to how fast that edge is
 * moving, and gets reabsorbed as the spring settles.
 *
 * The droplet's lead is clamped to the bridge budget. Push it further and it
 * stops being a droplet with a neck and becomes an unrelated dot floating
 * next to a bar, which reads as a rendering bug rather than a material.
 */
export function TensionSearch({
  width = 256,
  height = 48,
  blur = 8,
  liquid,
  placeholder = 'Search components',
}: {
  width?: number;
  height?: number;
  blur?: number;
  placeholder?: string;
  /** Override filter params (used by the tuning playground). */
  liquid?: Partial<TensionParams>;
}) {
  const [open, setOpen] = useState(false);
  const collapsed = height;

  const { values, velocities } = useSprings(
    [open ? width : collapsed],
    { stiffness: 200, damping: 19 },
  );
  const vel = velocities[0];

  // CLAMPED, not raw. A spring undershoots on the way back, and an undershoot
  // here drives the bar narrower than the icon it contains — the icon visibly
  // falls out of its own container. The overshoot at the open end is welcome
  // (that is the liquid arriving); the one at the collapsed end is a bug,
  // because `collapsed` is a hard physical floor, not a target.
  const barW = clamp(values[0], collapsed, width);

  // Lead is capped to a CLEAN MERGE, not to the outer bridge limit. Past the
  // clean-merge gap the neck thins to a hair and the droplet reads as a second
  // bubble sitting next to the bar rather than as liquid being pulled from it.
  const maxLead = cleanMergeGap(blur);
  const lead = clamp(vel * 0.012, -maxLead, maxLead);

  // Smaller than before: a droplet approaching the bar's own half-height stops
  // reading as a droplet and becomes a second lozenge.
  const r = clamp(Math.abs(vel) * 0.006, 0, height * 0.19);

  // Only on the way OUT. A droplet trailing a shrinking bar has no physical
  // story — liquid being pulled forward reads as surface tension, liquid left
  // behind reads as debris — and it was the source of the stray bubbles.
  const showDroplet = vel > 40 && r > 0.5;

  const bar: TensionShape = { x: 0, y: 0, w: barW, h: height, rx: height / 2 };
  const droplet: TensionShape = {
    x: barW + lead - r,
    y: height / 2 - r,
    w: r * 2,
    h: r * 2,
    rx: r,
  };

  const openness = clamp((barW - collapsed) / (width - collapsed), 0, 1);
  // Content sharpens as the liquid settles.
  const motionBlur = clamp(Math.abs(vel) * 0.0022, 0, 2.4);

  return (
    <Tension
      width={width}
      height={height}
      blur={blur}
      {...liquid}
      shapes={showDroplet ? [bar, droplet] : [bar]}
    >
      <TensionSlot shape={bar} motionBlur={motionBlur} style={{ justifyContent: 'flex-start' }}>
        <button
          type="button"
          className="tension-icon-btn"
          aria-expanded={open}
          aria-label={open ? 'Close search' : 'Open search'}
          onClick={() => setOpen((o) => !o)}
          style={{ width: height, height, flex: '0 0 auto' }}
        >
          <SearchIcon />
        </button>

        <input
          className="tension-input"
          placeholder={placeholder}
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
          style={{
            opacity: openness,
            // Not just fading — the field is genuinely not there until the
            // bar has room for it, so a click near the edge can't land on an
            // invisible input.
            pointerEvents: openness > 0.9 ? 'auto' : 'none',
            width: Math.max(0, barW - height - 16),
          }}
        />
      </TensionSlot>
    </Tension>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="5.25" stroke="currentColor" strokeWidth="1.7" />
      <path d="M11.5 11.5L15.5 15.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
