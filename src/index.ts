/**
 * surface-tension — UI components whose shapes merge, neck and separate like
 * a liquid, built from one SVG filter laid under ordinary DOM.
 *
 * No WebGL, no canvas, no runtime dependencies beyond React.
 */

// The primitive and its geometry types.
export { Tension, TensionSlot, TensionParamsContext, useTensionParams, TENSION_DEFAULTS } from './lib/tension/Tension';
export type { TensionShape, TensionParams, TensionTuning, TensionProps } from './lib/tension/Tension';

// The maths, and the four numeric guardrails that decide whether a layout works.
export {
  tensionOffset,
  tensionMatrix,
  bridgeDistance,
  cleanMergeGap,
  minShapeSize,
  filterPadding,
} from './lib/tension/threshold';

// Motion.
export { useSprings, MotionContext, SPRING, clamp } from './lib/tension/useSprings';
export type { SpringConfig, MotionScale } from './lib/tension/useSprings';

// The six worked components.
export { TensionSearch } from './lib/components/TensionSearch';
export { TensionDropdown } from './lib/components/TensionDropdown';
export { TensionAccordion } from './lib/components/TensionAccordion';
export { TensionTabs } from './lib/components/TensionTabs';
export { TensionSegmented } from './lib/components/TensionSegmented';
export { TensionChips } from './lib/components/TensionChips';
