import React, { useState } from 'react';
import { Tension, TensionSlot, TensionShape, TensionParams } from '../tension/Tension';
import { useSprings, clamp } from '../tension/useSprings';
import { cleanMergeGap } from '../tension/threshold';

/**
 * Segmented control.
 *
 * Principle demonstrated: SQUASH AND TRAILING MASS.
 *
 * The pill deforms while it travels — wider along the direction of motion,
 * shorter across it, roughly conserving area. That is the oldest trick in
 * animation and it is what separates "a pill that moves" from "a pill made of
 * something". The deformation is driven by live spring velocity, so it is
 * automatically proportional to how far you jumped: one segment gives a small
 * stretch, two gives a big one.
 *
 * Behind it, a droplet lags on a much softer spring and gets reabsorbed. It
 * is capped at the bridge budget so it always arrives connected — an
 * unconnected droplet reads as a bug, not a material.
 */
export function TensionSegmented({
  segments = ['Day', 'Week', 'Month'],
  segWidth = 80,
  blur = 6,
  liquid,
}: {
  segments?: string[];
  segWidth?: number;
  blur?: number;
  /** Override filter params (used by the tuning playground). */
  liquid?: Partial<TensionParams>;
}) {
  const [active, setActive] = useState(1);

  const trackPad = 4;
  const height = 44;
  const pillH = height - trackPad * 2;
  const width = segments.length * segWidth;
  const pillW = segWidth - trackPad * 2;

  const { values, velocities } = useSprings(
    [active * segWidth + trackPad],
    { stiffness: 300, damping: 23 },
  );
  const x = values[0];
  const vel = velocities[0];

  // Area-preserving-ish: what the pill gains in width it gives up in height.
  const stretch = clamp(Math.abs(vel) * 0.010, 0, 13);
  const squash = clamp(Math.abs(vel) * 0.004, 0, 5);

  // A superellipse-ish corner rather than a full pill. At rx = h/2 every
  // indicator in the kit converges on the same lozenge and the family stops
  // having any shape language of its own.
  const cornerR = 13;

  const pill: TensionShape = {
    x: x - stretch / 2,
    y: trackPad + squash / 2,
    w: pillW + stretch,
    h: pillH - squash,
    rx: cornerR,
  };

  // Trails on the opposite side to travel, capped inside the bridge budget.
  const maxLag = cleanMergeGap(blur);
  const lag = clamp(-vel * 0.02, -maxLag, maxLag);
  const dropR = clamp(Math.abs(vel) * 0.007, 0, pillH * 0.26);
  const droplet: TensionShape = {
    x: x + pillW / 2 + lag - dropR,
    y: height / 2 - dropR,
    w: dropR * 2,
    h: dropR * 2,
    rx: dropR,
  };

  return (
    <div className="tension-track" style={{ width, height, borderRadius: 16 }}>
      <Tension
        width={width}
        height={height}
        blur={blur}
        fill="var(--tension-accent)"
        shadow=""
        {...liquid}
        shapes={dropR > 0.5 ? [droplet, pill] : [pill]}
      >
        {segments.map((s, i) => {
          const slot: TensionShape = {
            x: i * segWidth,
            y: 0,
            w: segWidth,
            h: height,
            rx: 0,
          };
          return (
            <TensionSlot key={s} shape={slot}>
              <button
                type="button"
                className="tension-segment"
                aria-pressed={i === active}
                data-active={i === active}
                onClick={() => setActive(i)}
              >
                {s}
              </button>
            </TensionSlot>
          );
        })}
      </Tension>
    </div>
  );
}
