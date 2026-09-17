import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TensionParams, TensionParamsContext, TensionTuning } from '../src/lib/tension/Tension';
import { MotionContext } from '../src/lib/tension/useSprings';
import {
  bridgeDistance,
  cleanMergeGap,
  minShapeSize,
  tensionOffset,
} from '../src/lib/tension/threshold';
import { buildPrompt } from './prompts';
import { SPECS } from './specs';
import { TensionSearch } from '../src/lib/components/TensionSearch';
import { TensionDropdown } from '../src/lib/components/TensionDropdown';
import { TensionAccordion } from '../src/lib/components/TensionAccordion';
import { TensionTabs } from '../src/lib/components/TensionTabs';
import { TensionSegmented } from '../src/lib/components/TensionSegmented';
import { TensionChips } from '../src/lib/components/TensionChips';

/* ============================================================
   The six chapters
   ============================================================ */

interface Specimen {
  id: string;
  name: string;
  principle: string;
  lede: string;
  act: string;
  note: string;
  base: TensionParams;
  natural: number;
  render: (liquid: Partial<TensionParams>) => React.ReactNode;
}

const SPECIMENS: Specimen[] = [
  {
    id: 'search',
    name: 'Search',
    principle: 'Velocity-driven separation',
    lede: 'An icon that unfurls into a field, with liquid pulled forward off the leading edge.',
    act: 'Click the magnifier to expand, then again to collapse.',
    note: 'A bar that only grows is just a bar that grows. A droplet leads the edge, capped at the clean-fusion gap, and only shows up while expanding — trailing liquid just reads as debris.',
    base: { blur: 8, contrast: 18, threshold: 0.4167 },
    natural: 256,
    render: (liquid) => <TensionSearch liquid={liquid} />,
  },
  {
    id: 'dropdown',
    name: 'Dropdown',
    principle: 'One mass, two motions',
    lede: 'A single panel extruding from its trigger, with a second liquid travelling inside it.',
    act: 'Open the menu, then move between rows to travel the highlight.',
    note: 'A menu is one surface, not six little blobs. This panel holds an even row pitch; the liquid’s real work happens in the hover highlight instead, trailing a droplet as it travels between rows.',
    base: { blur: 6, contrast: 18, threshold: 0.4167 },
    natural: 208,
    render: (liquid) => <TensionDropdown liquid={liquid} />,
  },
  {
    id: 'accordion',
    name: 'Accordion',
    principle: 'Corner timeline',
    lede: 'A panel that extrudes from its header as one body, its corners relaxing from pill to card.',
    act: 'Toggle it, and watch the corners relax as it opens.',
    note: 'Header and panel overlap, so they’re one mass at every frame. Corners relax from pill to card through the merge, and content only fades in over the last stretch of travel — never past its own edge.',
    base: { blur: 7, contrast: 18, threshold: 0.4167 },
    natural: 256,
    render: (liquid) => <TensionAccordion liquid={liquid} />,
  },
  {
    id: 'tabs',
    name: 'Tab bar',
    principle: 'Thin shapes need low blur',
    lede: 'An underline that stretches between tabs, with a bead trailing inside it.',
    act: 'Jump two tabs at once — the longer travel stretches further.',
    note: 'The constraint that breaks most first attempts: blur thins a shape’s alpha until it vanishes, so a 6px underline caps blur at 3. A bead riding inside the bar carries the liquid read the bar itself can’t afford.',
    base: { blur: 3, contrast: 26, threshold: 0.4167 },
    natural: 252,
    render: (liquid) => <TensionTabs liquid={liquid} />,
  },
  {
    id: 'segmented',
    name: 'Segmented control',
    principle: 'Squash and trailing mass',
    lede: 'A pill that deforms with its own velocity and leaves a droplet behind.',
    act: 'Skip a segment to see the squash exaggerate.',
    note: 'The pill stretches and thins with its own velocity, roughly conserving area — the oldest trick in animation. Its corner defaults to half its height, so every indicator in the family converges on one lozenge.',
    base: { blur: 6, contrast: 18, threshold: 0.4167 },
    natural: 240,
    render: (liquid) => <TensionSegmented liquid={liquid} />,
  },
  {
    id: 'chips',
    name: 'Multi-select chips',
    principle: 'Anchored merge',
    lede: 'Selected neighbours fuse into one mass — and only the chip you touched moves.',
    act: 'Select a chip beside another selected one to fuse them.',
    note: 'The one component here where the liquid isn’t decoration — fused neighbours show you what’s grouped before you read a label. Positions stay anchored, so selecting one chip moves exactly one chip.',
    base: { blur: 5, contrast: 18, threshold: 0.4167 },
    natural: 468,
    render: (liquid) => <TensionChips liquid={liquid} />,
  },
];

const SKILL_INSTALL_COMMAND = 'npx skills add maitreyi0002-beep/morphing-flow';
const SKILL_RAW_URL =
  'https://raw.githubusercontent.com/maitreyi0002-beep/morphing-flow/main/SKILL.md';

/* ============================================================
   Controls
   ============================================================ */

const DEFAULTS = {
  blurX: 1,
  contrastX: 1,
  thresholdD: 0,
  speed: 1,
  bounce: 0.5,
  contentBlur: 1,
  radius: 1,
};
type Controls = typeof DEFAULTS;
type Theme = 'system' | 'light' | 'dark';
type Ground = 'paper' | 'ink';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/**
 * Which chapter is currently in view, for the contents list.
 *
 * Deliberately not an IntersectionObserver keyed on intersectionRatio: ratio
 * is intersected-area over ELEMENT area, so a tall chapter barely in view
 * scores lower than a short one fully in view, and entries only update when
 * they cross a threshold, which leaves stale values in the map. The result is
 * the list marking the wrong chapter — visibly wrong at the top of the page.
 *
 * "The last heading to have passed a line a third down the viewport" is what a
 * reader actually means by where they are, and it is one comparison.
 */
function useActiveChapter(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * 0.33;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActive((prev) => (prev === current ? prev : current));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ids.join('|')]);
  return active;
}

function App() {
  const [c, setC] = useState<Controls>(DEFAULTS);
  const [theme, setTheme] = useState<Theme>('system');
  const [ground, setGround] = useState<Ground>('paper');
  const activeId = useActiveChapter(['skill', ...SPECIMENS.map((s) => s.id)]);

  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
  }, [theme]);

  const set = <K extends keyof Controls>(k: K) => (v: number) =>
    setC((p) => ({ ...p, [k]: v }));

  const dirty = (Object.keys(DEFAULTS) as (keyof Controls)[]).some(
    (k) => c[k] !== DEFAULTS[k],
  );

  const tuning: Partial<TensionTuning> = {
    radiusScale: c.radius,
    contentBlurScale: c.contentBlur,
  };

  return (
    <TensionParamsContext.Provider value={tuning}>
      <MotionContext.Provider value={{ speed: c.speed, bounce: c.bounce }}>
        <div className="page">
          <header className="masthead">
            <a className="portfolio-return" href="https://maitreyi0002-beep.github.io/maitreyi-portfolio/#experiments">← Back to portfolio</a>
            <p className="kicker">A working monograph</p>
            <h1>
              Morphing<span> Flow</span>
            </h1>
            <p className="deck">
              Six interface components whose shapes merge, neck and separate like
              a liquid — built from one SVG filter laid under ordinary DOM. No
              WebGL, no canvas, no dependencies. Every control below is a real,
              focusable, readable element.
            </p>
            <p className="byline">
              Technique distilled from Jakub Antalik’s{' '}
              <a href="https://gooey.jakubantalik.com/" target="_blank" rel="noopener noreferrer">
                liquid-liquid
              </a>
              , whose filters resolve to a threshold of 0.4167 — the value this
              kit ships as its default.
            </p>
          </header>

          <section className="skill-callout" id="skill">
            <h2>Use it as a skill</h2>
            <p>
              Everything here — the filter maths, the four guardrails, every
              component spec, the mistakes that produced each rule — is also
              packaged as an agent skill. Install it and your coding agent can
              build these components itself, no page required.
            </p>
            <div className="install">
              <code>{SKILL_INSTALL_COMMAND}</code>
              <CopyButton
                text={SKILL_INSTALL_COMMAND}
                label={{
                  idle: 'Copy install command',
                  done: 'Command copied',
                  failed: 'Copy blocked — select manually',
                }}
              />
            </div>
            <p>
              Works with Claude Code, Cursor, Copilot and most other agents.
              Anything else, just hand it the file — it’s one markdown
              document.{' '}
              <a href={SKILL_RAW_URL} target="_blank" rel="noopener noreferrer">
                Read SKILL.md
              </a>
            </p>
          </section>

          <div className="layout">
            <nav className="index" aria-label="Contents">
              <p className="aside-label">Contents</p>
              <ol>
                <li className="index-extra">
                  <a href="#skill" data-active={activeId === 'skill'}>
                    Use it as a skill
                  </a>
                </li>
                {SPECIMENS.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} data-active={s.id === activeId}>
                      <span>{String(i + 1).padStart(2, '0')}</span>
                      {s.name}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <main className="doc">
              {SPECIMENS.map((s, i) => (
                <Chapter key={s.id} spec={s} index={i + 1} c={c} ground={ground} />
              ))}

              <section className="closing">
                <h2>On the merge meaning something</h2>
                <p>
                  Merging that encodes state — grouped, selected, connected, in
                  progress — earns its place; merging that just looks wet
                  doesn’t. Of the six above, only the chips’ silhouette carries
                  information you’d otherwise read elsewhere.
                </p>
              </section>
            </main>

            <aside className="controls" aria-label="Controls">
              <div className="aside-head">
                <p className="aside-label">Controls</p>
                <button
                  type="button"
                  className="link"
                  onClick={() => setC(DEFAULTS)}
                  disabled={!dirty}
                >
                  Reset
                </button>
              </div>
              <p className="aside-note">
                Multipliers on each component’s own tuning, applied to all six at
                once.
              </p>

              <Group name="Filter">
                  <Slider label="Blur" v={c.blurX} min={0.35} max={2.4} step={0.05} fmt={mul} on={set('blurX')} />
                  <Slider label="Contrast" v={c.contrastX} min={0.35} max={2.4} step={0.05} fmt={mul} on={set('contrastX')} />
                  <Slider label="Threshold" v={c.thresholdD} min={-0.14} max={0.16} step={0.005} fmt={(v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3)}`} on={set('thresholdD')} />
              </Group>

              <Group name="Motion">
                  <Slider label="Speed" v={c.speed} min={0.3} max={2.6} step={0.05} fmt={mul} on={set('speed')} />
                  <Slider label="Bounce" v={c.bounce} min={0} max={1} step={0.02} fmt={(v) => v.toFixed(2)} on={set('bounce')} />
                  <Slider label="Content blur" v={c.contentBlur} min={0} max={2.5} step={0.05} fmt={(v) => (v === 0 ? 'off' : mul(v))} on={set('contentBlur')} />
              </Group>

              <Group name="Form">
                  <Slider label="Corner radius" v={c.radius} min={0} max={1.35} step={0.01} fmt={mul} on={set('radius')} />
              </Group>

              <Group name="Ground">
                  <Toggle
                    value={ground}
                    options={[['paper', 'Paper'], ['ink', 'Ink']]}
                    onChange={(v) => setGround(v as Ground)}
                  />
              </Group>

              <Group name="Appearance">
                  <Toggle
                    value={theme}
                    options={[['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]}
                    onChange={(v) => setTheme(v as Theme)}
                  />
              </Group>
            </aside>
          </div>
        </div>
      </MotionContext.Provider>
    </TensionParamsContext.Provider>
  );
}

const mul = (v: number) => `×${v.toFixed(2)}`;

function Chapter({
  spec,
  index,
  c,
  ground,
}: {
  spec: Specimen;
  index: number;
  c: Controls;
  ground: Ground;
}) {
  const [fieldRef, fieldW] = useWidth<HTMLDivElement>();

  const p: TensionParams = useMemo(
    () => ({
      blur: Math.round(spec.base.blur * c.blurX * 10) / 10,
      contrast: Math.round(spec.base.contrast * c.contrastX * 10) / 10,
      threshold: Math.min(0.85, Math.max(0.1, spec.base.threshold + c.thresholdD)),
    }),
    [spec, c.blurX, c.contrastX, c.thresholdD],
  );

  // Never let a component overflow its own figure on a narrow screen.
  const fit = fieldW > 0 ? Math.min(1, (fieldW - 48) / spec.natural) : 1;

  return (
    <section className="chapter" id={spec.id}>
      <header className="chapter-head">
        <span className="num">{String(index).padStart(2, '0')}</span>
        <h2>{spec.name}</h2>
        <p className="principle">{spec.principle}</p>
      </header>

      <p className="prose lede">{spec.lede}</p>

      <figure className="figure">
        <div className="field" data-ground={ground} ref={fieldRef}>
          <div style={{ transform: `scale(${fit})` }}>{spec.render(p)}</div>
        </div>
        <figcaption>
          <span>{spec.act}</span>
          <CopyPrompt spec={spec} params={p} />
        </figcaption>
      </figure>

      <p className="prose">{spec.note}</p>

      <p className="measure">
        <Val k="blur" v={p.blur} />
        <Val k="contrast" v={p.contrast} />
        <Val k="threshold" v={p.threshold.toFixed(3)} />
        <Val k="offset" v={tensionOffset(p.contrast, p.threshold)} />
        <Val k="bridge" v={`${bridgeDistance(p.blur, p.threshold).toFixed(1)}px`} />
        <Val k="fuse" v={`${cleanMergeGap(p.blur, p.threshold).toFixed(1)}px`} />
        <Val k="min shape" v={`${minShapeSize(p.blur)}px`} />
      </p>
    </section>
  );
}

/**
 * Copies text to the clipboard, falling back to a selectable textarea where
 * clipboard access is refused (some embedded contexts).
 */
function CopyButton({
  text,
  label,
}: {
  text: string | (() => string);
  label: { idle: string; done: string; failed: string };
}) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');

  const copy = async () => {
    const value = typeof text === 'function' ? text() : text;
    try {
      await navigator.clipboard.writeText(value);
      setState('done');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.cssText = 'position:fixed;top:-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand?.('copy');
      document.body.removeChild(ta);
      setState(ok ? 'done' : 'failed');
    }
    window.setTimeout(() => setState('idle'), 2600);
  };

  return (
    <button type="button" className="copy" onClick={copy} data-state={state}>
      {state === 'done' ? label.done : state === 'failed' ? label.failed : label.idle}
    </button>
  );
}

/**
 * Copies a complete, self-contained build prompt for this component — carrying
 * the current slider values, so a tuned page hands over its tuning.
 */
function CopyPrompt({ spec, params }: { spec: Specimen; params: TensionParams }) {
  return (
    <CopyButton
      text={() => buildPrompt(spec.name, spec.principle, params, SPECS[spec.id])}
      label={{
        idle: 'Copy build prompt',
        done: 'Prompt copied',
        failed: 'Copy blocked — select manually',
      }}
    />
  );
}

function Val({ k, v }: { k: string; v: string | number }) {
  return (
    <span>
      <em>{k}</em>
      {v}
    </span>
  );
}

function Group({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <section className="group">
      <h3>{name}</h3>
      {children}
    </section>
  );
}

function Slider({
  label,
  v,
  min,
  max,
  step,
  fmt,
  on,
}: {
  label: string;
  v: number;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  on: (v: number) => void;
}) {
  const id = `s-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="ctl">
      <label htmlFor={id}>
        {label}
        <span>{fmt(v)}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => on(parseFloat(e.target.value))}
        style={{ ['--pct' as string]: `${((v - min) / (max - min)) * 100}%` }}
      />
    </div>
  );
}

function Toggle({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <div className="toggle">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          data-on={v === value}
          aria-pressed={v === value}
          onClick={() => onChange(v)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
