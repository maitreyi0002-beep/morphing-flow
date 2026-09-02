/**
 * Builds the monograph into a single self-contained HTML file.
 *
 * React is bundled in rather than pulled from a CDN, so the output has zero
 * network dependencies beyond the webfonts and can be dropped on any static
 * host — or opened straight off disk.
 */
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const OUT = 'site-dist';
const FONTS =
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?' +
  'family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;1,6..72,400' +
  '&family=Instrument+Sans:wght@400;500;600' +
  '&family=JetBrains+Mono:wght@400;500&display=swap">';

const watch = process.argv.includes('--watch');

async function run() {
  await mkdir(OUT, { recursive: true });

  const result = await build({
    entryPoints: ['site/app.tsx'],
    bundle: true,
    minify: !watch,
    format: 'iife',
    jsx: 'automatic',
    target: 'es2019',
    define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
    write: false,
  });

  const js = result.outputFiles[0].text;
  const css = await readFile('site/styles.css', 'utf8');
  const head = `<title>Morphing Flow</title>\n${FONTS}\n<style>\n${css}\n</style>`;
  const body = '<div id="root"></div>';

  // Full document, for hosting and for opening off disk.
  await writeFile(
    `${OUT}/index.html`,
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<meta name="description" content="Six UI components whose shapes merge, neck and separate like a liquid — one SVG filter under ordinary DOM.">` +
      `${head}</head><body>${body}<script>${js}</script></body></html>`,
  );

  // Body-only, for embedding in hosts that supply their own document shell.
  await writeFile(
    `${OUT}/embed.html`,
    `${head}\n${body}\n<script>\n${js}\n</script>\n`,
  );

  const kb = (Buffer.byteLength(js) / 1024).toFixed(0);
  console.log(`${OUT}/index.html  (${kb}kb of script)`);
}

if (watch) {
  const { watch: fsWatch } = await import('node:fs');
  await run();
  for (const dir of ['site', 'src']) {
    fsWatch(dir, { recursive: true }, () => run().catch(console.error));
  }
  console.log('watching site/ and src/ …');
} else {
  await run();
}
