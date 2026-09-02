import React, { useEffect, useRef, useState } from 'react';
import { Tension, TensionShape, TensionParams } from '../tension/Tension';
import { useSprings, clamp } from '../tension/useSprings';
import { minShapeSize } from '../tension/threshold';

/**
 * Tab bar with a morphing underline.
 *
 * Principle demonstrated: THIN SHAPES NEED LOW BLUR.
 *
 * This is the constraint that breaks most first attempts. Blur spreads a thin
 * shape's alpha until its own peak drops below the threshold and it vanishes
 * completely. A 6px underline at the kit default of blur 6 does not look
 * subtle — it disappears. `minShapeSize(blur)` is the floor; a 6px bar caps
 * blur at 3.
 *
 * Low blur buys a small bridge budget (~7px), so the liquid has to come from
 * shapes that are nearly touching. Hence the bead: a fatter lozenge riding
 * inside the bar on a lazier spring, which trails during travel and pulls the
 * silhouette into a teardrop. The bar alone would just slide.
 *
 * The bar also stretches, because its leading and trailing edges are on
 * different springs — the edge moving into new space is stiffer than the edge
 * letting go, so the bar elongates in flight and contracts on arrival. Which
 * edge is "leading" flips with direction.
 */
export function TensionTabs({
  tabs = ['Overview', 'Activity', 'Settings'],
  tabWidth = 84,
  blur = 3,
  liquid,
}: {
  tabs?: string[];
  tabWidth?: number;
  blur?: number;
  /** Override filter params (used by the tuning playground). */
  liquid?: Partial<TensionParams>;
}) {
  const [active, setActive] = useState(0);

  const barH = Math.max(6, minShapeSize(blur));
  const labelH = 40;
  const barY = labelH + 4;
  const width = tabs.length * tabWidth;
  const height = barY + barH + 6;
  const inset = 14;

  const targetLeft = active * tabWidth + inset;
  const targetRight = (active + 1) * tabWidth - inset;

  // Direction comes from the index change, not from live positions — reading
  // positions during render to decide a config that feeds those same
  // positions is a loop waiting to happen.
  const prevActive = useRef(active);
  const movingRight = active >= prevActive.current;
  useEffect(() => {
    prevActive.current = active;
  }, [active]);

  const { values, velocities } = useSprings([targetLeft, targetRight], {
    stiffness: movingRight ? [190, 360] : [360, 190],
    damping: [23, 23],
  });
  const [left, right] = values;

  const speed = Math.abs(velocities[0]) + Math.abs(velocities[1]);

  const bar: TensionShape = {
    x: left,
    y: barY,
    w: right - left,
    h: barH,
    // Not barH/2. A fully rounded 6px bar is a capsule, and a capsule reads as
    // a pill that happens to be short rather than as an underline.
    rx: 2.5,
  };

  const { values: beadV } = useSprings([(targetLeft + targetRight) / 2], {
    stiffness: 130,
    damping: 15,
  });
  const beadR = clamp(barH / 2 + speed * 0.0022, barH / 2, barH * 1.15);
  const bead: TensionShape = {
    x: beadV[0] - beadR,
    y: barY + barH / 2 - beadR,
    w: beadR * 2,
    h: beadR * 2,
    rx: beadR,
  };

  return (
    <Tension
      width={width}
      height={height}
      blur={blur}
      contrast={26}
      fill="var(--tension-accent)"
      shadow=""
      {...liquid}
      shapes={[bar, bead]}
    >
      <div className="tension-tabrow" role="tablist" style={{ height: labelH }}>
        {tabs.map((t, i) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={i === active}
            className="tension-tab"
            style={{ width: tabWidth }}
            onClick={() => setActive(i)}
          >
            {t}
          </button>
        ))}
      </div>
    </Tension>
  );
}
