import React, { useState } from 'react';
import { Tension, TensionSlot, TensionShape, TensionParams } from '../tension/Tension';
import { useSprings, clamp } from '../tension/useSprings';
import { cleanMergeGap } from '../tension/threshold';

/**
 * Dropdown.
 *
 * Principle demonstrated: ONE MASS, TWO LAYERS OF MOTION.
 *
 * The first version made each option its own blob and let them string out on
 * staggered springs. It demonstrated necking nicely and was a bad dropdown:
 * inconsistent spacing (the gaps are whatever the springs happen to be doing),
 * and one option always left dangling off the trigger.
 *
 * A menu is one surface. So the liquid here is a single panel that grows out
 * of the trigger — held inside the clean-merge gap so the two are always one
 * body — and the options are laid out at fixed, even intervals inside it, with
 * hairline separators on the content layer.
 *
 * The liquid then does its work in a SECOND, independent place: the hover
 * highlight. That is a `move` effect rather than a `morph` — the highlight
 * chases the pointer's row on a spring, stretching along its travel and
 * trailing a droplet, and it lives in its own filter group so it never merges
 * with the panel behind it.
 *
 * Note the separators are DOM, not surface shapes. A 1px line inside the filter
 * would be erased outright — see minShapeSize().
 */
export function TensionDropdown({
  width = 208,
  label = 'Choose a size',
  items = ['Small', 'Medium', 'Large'],
  blur = 6,
  liquid,
}: {
  width?: number;
  label?: string;
  items?: string[];
  blur?: number;
  /** Override filter params (used by the tuning playground). */
  liquid?: Partial<TensionParams>;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const triggerH = 46;
  const itemH = 42;
  const padY = 7;

  // OVERLAP, not a gap. Two same-width rects separated by even a few px merge
  // into an hourglass: the liquid fills the join but leaves a concave fillet at
  // each side, and the result reads as a pinched bowtie rather than a card.
  // Sinking the panel up under the trigger by more than its corner radius
  // makes the union a single clean rectangle.
  const overlap = 20;
  const panelTop = triggerH - overlap;
  const panelH = items.length * itemH + padY * 2 + overlap;

  // Panel height, panel width, and the trigger's corner radius all on one
  // spring vector. The radius matters: a pill-radius trigger sitting on a
  // pill-radius panel reads as two stacked lozenges. Relaxing the corners as
  // it opens lets the merged silhouette resolve into a single card.
  const { values, velocities } = useSprings(
    [open ? panelH : 0, open ? width : width * 0.72, open ? 18 : triggerH / 2],
    { stiffness: [250, 210, 230], damping: [26, 22, 26] },
  );
  const [h, w, rx] = values;
  const panelSpeed = Math.abs(velocities[0]) + Math.abs(velocities[1]);

  const trigger: TensionShape = { x: 0, y: 0, w: width, h: triggerH, rx };
  const panel: TensionShape = {
    x: (width - w) / 2,
    y: panelTop,
    w,
    h,
    rx: Math.min(18, h / 2),
  };

  // Options only become real once the panel can actually hold them.
  const reveal = clamp((h - panelH * 0.55) / (panelH * 0.45), 0, 1);
  const rowY = (i: number) => panelTop + overlap + padY + i * itemH;

  return (
    <Tension
      width={width}
      height={panelTop + panelH}
      blur={blur}
      {...liquid}
      shapes={h > 1 ? [panel, trigger] : [trigger]}
    >
      {/* The highlight is FIRST in the content layer so the labels paint over
          it. Its own filter group keeps it from merging into the panel. */}
      <HoverPill
        x={8}
        width={width - 16}
        height={itemH - 4}
        top={(i: number) => rowY(i) + 2}
        index={open ? hover : null}
        blur={Math.max(3, blur - 2)}
        liquid={liquid}
      />

      {/* Rows: hit area, label and separator. No background — the panel
          underneath is their surface. */}
      {items.map((item, i) => {
        const row: TensionShape = { x: 0, y: rowY(i), w: width, h: itemH, rx: 0 };
        return (
          <TensionSlot key={item} shape={row} style={{ opacity: reveal }}>
            <button
              type="button"
              className="tension-menu-item"
              tabIndex={open ? 0 : -1}
              aria-hidden={!open}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => {
                setChosen(item);
                setOpen(false);
                setHover(null);
              }}
            >
              {item}
            </button>
            {i > 0 && (
              <span
                className="tension-separator"
                aria-hidden="true"
                /* A rule running under the travelling highlight reads as a
                   crack in the liquid. Retire it while either neighbouring
                   row owns the highlight. */
                data-muted={hover === i || hover === i - 1}
              />
            )}
          </TensionSlot>
        );
      })}

      <TensionSlot shape={trigger} motionBlur={clamp(panelSpeed * 0.002, 0, 3)}>
        <button
          type="button"
          className="tension-trigger"
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((o) => !o)}
        >
          <span>{chosen ?? label}</span>
          <Chevron open={open} />
        </button>
      </TensionSlot>
    </Tension>
  );
}

/**
 * The travelling highlight — liquid-liquid's `move` effect in miniature.
 *
 * Two things make it read as liquid rather than as a rectangle being moved:
 * it stretches along its direction of travel (velocity-driven, area roughly
 * conserved), and a droplet trails off its back edge inside the clean-merge
 * gap so it necks rather than detaching.
 */
function HoverPill({
  x,
  width,
  height,
  top,
  index,
  blur,
  liquid,
}: {
  x: number;
  width: number;
  height: number;
  top: (i: number) => number;
  index: number | null;
  blur: number;
  liquid?: Partial<TensionParams>;
}) {
  // Park at the last hovered row and fade, rather than snapping to zero — a
  // highlight that teleports home on mouse-out undoes the whole effect.
  const [lastIndex, setLastIndex] = useState(0);
  if (index !== null && index !== lastIndex) setLastIndex(index);

  const { values, velocities } = useSprings(
    [top(lastIndex), index === null ? 0 : 1],
    { stiffness: [300, 320], damping: [24, 30] },
  );
  const [y, on] = values;
  const vel = velocities[0];

  if (on < 0.02) return null;

  const stretch = clamp(Math.abs(vel) * 0.05, 0, 10);
  const maxLag = cleanMergeGap(blur);
  const lag = clamp(-vel * 0.02, -maxLag, maxLag);
  const dropR = clamp(Math.abs(vel) * 0.018, 0, height * 0.3);

  const pill: TensionShape = {
    x: 0,
    y: y - stretch / 2,
    w: width,
    h: height + stretch,
    rx: 11,
  };
  const droplet: TensionShape = {
    x: width / 2 - dropR,
    y: y + height / 2 + lag - dropR,
    w: dropR * 2,
    h: dropR * 2,
    rx: dropR,
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: 0,
        // Opacity lives HERE, not on the shape. A fill whose alpha is below
        // the liquid threshold is erased outright by feColorMatrix — the filter
        // only ever renders fully opaque or fully absent.
        opacity: on,
      }}
      aria-hidden="true"
    >
      <Tension
        width={width}
        height={y + height + 40}
        blur={blur}
        {...liquid}
        fill="var(--tension-highlight)"
        shadow=""
        shapes={dropR > 0.5 ? [droplet, pill] : [pill]}
      />
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      style={{
        transform: `rotate(${open ? 180 : 0}deg)`,
        transition: 'transform .34s cubic-bezier(.2,.9,.3,1.15)',
      }}
    >
      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
