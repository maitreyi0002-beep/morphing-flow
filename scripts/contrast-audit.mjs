import { chromium } from 'playwright';

/* ---------------------------------------------------------------------------
   Surface contrast audit.

   The bug class this exists to catch, which has now bitten twice: component
   text coloured from the WRONG SURFACE's token. Text in these components sits
   on one of three surfaces —

     the liquid          (--tension-fill)
     the accent liquid   (--tension-accent)
     the ground behind   (the field's own background)

   — and those three invert independently of each other AND of the page theme.
   The liquid stays light on a dark page; the ground does not. Reading a label's
   colour from --tension-ink when it actually sits on the ground gives you dark text
   on a dark ground, which is precisely how the tab labels disappeared.

   Rather than sampling pixels (React's spring loop re-renders continuously and
   fights DOM mutation), this asks the browser for each label's resolved colour
   and for the token of the surface it is declared to sit on, then composites
   any alpha in Node. Deterministic, and it names the surface in the failure.
   --------------------------------------------------------------------------- */

const CHECKS = [
  ['#search .tension-input', 'search placeholder', 'tension-fill'],
  ['#search .tension-icon-btn', 'search icon', 'tension-fill'],
  ['#dropdown .tension-trigger', 'dropdown trigger', 'tension-fill'],
  ['#dropdown .tension-menu-item', 'dropdown item', 'tension-fill'],
  ['#accordion .tension-trigger', 'accordion header', 'tension-fill'],
  ['#tabs .tension-tab[aria-selected="true"]', 'tab active', 'field'],
  ['#tabs .tension-tab[aria-selected="false"]', 'tab inactive', 'field'],
  ['#segmented .tension-segment[data-active="true"]', 'segment active', 'tension-accent'],
  ['#segmented .tension-segment[data-active="false"]', 'segment inactive', 'field'],
  ['#chips .tension-chip[data-on="true"]', 'chip selected', 'tension-accent'],
  ['#chips .tension-chip[data-on="false"]', 'chip unselected', 'tension-fill'],
];

const lum = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
/** Composite a possibly-translucent foreground over an opaque background. */
const over = (fg, bg) => {
  const a = fg[3] ?? 1;
  return [0, 1, 2].map((i) => Math.round(fg[i] * a + bg[i] * (1 - a)));
};

(async () => {
  // Honour a pre-provisioned browser. Useful in sandboxes and locked-down CI
  // where `npx playwright install` cannot reach the download host.
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const fails = [];
  let worst = { r: 99, what: '' };

  for (const scheme of ['light', 'dark']) {
    for (const ground of ['paper', 'ink']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, colorScheme: scheme });
      await page.goto('file://' + process.cwd() + '/site-dist/index.html');
      await page.waitForTimeout(700);
      if (ground === 'ink') { await page.click('.toggle button:has-text("Ink")'); await page.waitForTimeout(500); }
      await page.click('#search .tension-icon-btn');
      await page.click('#dropdown .tension-trigger');
      await page.waitForTimeout(700);

      for (const [sel, label, surface] of CHECKS) {
        const tag = `${scheme}/${ground}  ${label.padEnd(20)} on ${surface}`;
        const got = await page.evaluate(
          ([sel, surface]) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            // Canvas normalises every CSS colour form — hex, color-mix(),
            // color(srgb …) — into plain RGBA bytes.
            const norm = (css) => {
              const cv = document.createElement('canvas');
              cv.width = cv.height = 1;
              const ctx = cv.getContext('2d');
              ctx.clearRect(0, 0, 1, 1);
              ctx.fillStyle = css;
              ctx.fillRect(0, 0, 1, 1);
              const d = ctx.getImageData(0, 0, 1, 1).data;
              return [d[0], d[1], d[2], d[3] / 255];
            };
            const cs = getComputedStyle(el);
            const field = el.closest('.field');
            const surfaceCss =
              surface === 'field'
                ? getComputedStyle(field).backgroundColor
                : cs.getPropertyValue(`--${surface}`).trim();
            return { fg: norm(cs.color), bg: norm(surfaceCss) };
          },
          [sel, surface],
        );
        if (!got) { fails.push(`${tag}: MISSING`); continue; }

        const bg = got.bg.slice(0, 3);
        const r = ratio(over(got.fg, bg), bg);
        if (r < worst.r) worst = { r, what: tag };
        if (r < 3) fails.push(`${tag}: ${r.toFixed(2)}:1   fg=rgba(${got.fg}) surface=rgb(${bg})`);
      }
      await page.close();
    }
  }

  if (fails.length) {
    console.log('FAIL\n' + fails.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('PASS — every label ≥ 3:1 against its own surface, across light/dark × paper/ink.');
    console.log(`worst: ${worst.what} at ${worst.r.toFixed(2)}:1`);
  }
  await browser.close();
})();
