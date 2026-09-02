import React, { useMemo, useState } from 'react';
import { Tension, TensionSlot, TensionShape, TensionParams } from '../tension/Tension';
import { useSprings } from '../tension/useSprings';
import { cleanMergeGap } from '../tension/threshold';

/**
 * Multi-select chips.
 *
 * Principle demonstrated: THE MERGE CARRIES MEANING — and ANCHORED MOTION.
 *
 * The liquid here is not decoration. A run of adjacent selected chips closes its
 * gaps and fuses into one mass, so the silhouette tells you what is grouped
 * before you read a single label.
 *
 * The first version recomputed the whole row's layout from the gaps, which is
 * the obvious implementation and the wrong one: changing one gap shifted every
 * chip to its right, so selecting a chip made the entire row lurch. Four things
 * moving to express one change reads as a jolt, not as liquid.
 *
 * The fix is that positions are ANCHORED. Every chip has a fixed base slot on
 * an even pitch and stays there. A chip only moves when it is fused to its
 * left-hand neighbour, and then only by the amount that closes that one gap,
 * accumulated along a fused run. The leftmost chip never moves; chips after a
 * fused run never move. So selecting chip 3 moves chip 3, and nothing else.
 *
 * Springs are near-critically damped for the same reason — overshoot on a
 * closing gap looks like a collision, not a settle.
 */
export function TensionChips({
  options = ['Design', 'Research', 'Motion', 'Systems'],
  blur = 5,
  liquid,
}: {
  options?: string[];
  blur?: number;
  /** Override filter params (used by the tuning playground). */
  liquid?: Partial<TensionParams>;
}) {
  const [selected, setSelected] = useState<number[]>([1, 2]);
  const isOn = (i: number) => selected.includes(i);

  const height = 40;
  const gapApart = 22; // > bridgeDistance(5) ≈ 8px → unambiguously separate
  const gapFused = Math.max(2, Math.round(cleanMergeGap(blur) * 0.6));
  const pull = gapApart - gapFused;

  // Width from label length keeps the demo free of a measurement pass. In
  // production, measure with a ResizeObserver and feed real widths in.
  const widths = useMemo(
    () => options.map((o) => Math.round(o.length * 8.2) + 34),
    [options],
  );

  // Fixed slots on an even pitch. These never change.
  const baseX = useMemo(() => {
    const xs: number[] = [];
    let cursor = 0;
    for (let i = 0; i < options.length; i++) {
      xs.push(cursor);
      cursor += widths[i] + gapApart;
    }
    return xs;
  }, [widths, options.length]);

  // Offset accumulates along a fused run and RESETS to zero the moment the run
  // breaks — that reset is what keeps chips after the run pinned in place.
  const targets: number[] = [];
  let offset = 0;
  for (let i = 0; i < options.length; i++) {
    offset = i > 0 && isOn(i) && isOn(i - 1) ? offset - pull : 0;
    targets.push(baseX[i] + offset);
  }

  const { values: xs } = useSprings(targets, { stiffness: 200, damping: 27 });
  const totalW = baseX[baseX.length - 1] + widths[widths.length - 1] + 2;

  const shapes: TensionShape[] = xs.map((x, i) => ({
    x,
    y: 0,
    w: widths[i],
    h: height,
    rx: height / 2,
    fill: isOn(i) ? 'var(--tension-accent)' : 'var(--tension-fill)',
  }));

  const toggle = (i: number) =>
    setSelected((s) => (s.includes(i) ? s.filter((n) => n !== i) : [...s, i]));

  return (
    <Tension width={totalW} height={height} blur={blur} {...liquid} shapes={shapes}>
      {shapes.map((shape, i) => (
        <TensionSlot key={options[i]} shape={shape}>
          <button
            type="button"
            className="tension-chip"
            role="switch"
            aria-checked={isOn(i)}
            data-on={isOn(i)}
            onClick={() => toggle(i)}
          >
            {options[i]}
          </button>
        </TensionSlot>
      ))}
    </Tension>
  );
}
