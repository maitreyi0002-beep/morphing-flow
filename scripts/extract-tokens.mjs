/**
 * Pulls the component-facing custom properties out of the site stylesheet into
 * a standalone tokens.css that consumers of the package can import.
 *
 * Only the --tension-* group ships: the rest of the stylesheet is the
 * monograph's own design, which is not the package's business.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const css = await readFile('site/styles.css', 'utf8');

const grab = (selector) => {
  const at = css.indexOf(selector);
  if (at === -1) return [];
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('--tension-') || l.startsWith('--field-ink'));
};

const light = grab(':root {');
const dark = grab(":root[data-theme='dark']");

const out = `/* surface-tension — component tokens.
 *
 * Three surfaces, and they invert independently of each other and of your page
 * theme: the liquid usually stays light on a dark page, the ground does not.
 * Colour every label from the surface it actually sits on.
 *
 *   --tension-fill        the liquid itself
 *   --tension-ink         text ON the liquid
 *   --tension-accent      the accent liquid
 *   --tension-on-accent   text ON the accent liquid
 *   --field-ink           text on the GROUND behind the component
 */

:root {
${light.map((l) => '  ' + l).join('\n')}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${dark.map((l) => '    ' + l).join('\n')}
  }
}

:root[data-theme='dark'] {
${dark.map((l) => '  ' + l).join('\n')}
}
`;

await mkdir('dist', { recursive: true });
await writeFile('dist/tokens.css', out);
console.log(`dist/tokens.css  (${light.length} tokens)`);
