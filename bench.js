import { createRequire } from 'node:module';
import { renderMarkdown } from '@ox-content/vite-plugin';

// The same @pierre/highlights build that @ox-content/vite-plugin depends on.
const pluginRequire = createRequire(createRequire(import.meta.url).resolve('@ox-content/vite-plugin'));
const { codeToTokens } = await import(pluginRequire.resolve('@pierre/highlights'));
const theme = { name: 'ox-content', appearance: 'dark', style: {}, cssVariables: true };

const block = 'export async function load(path: string, retries = 3): Promise<string> {\n  for (let i = 0; i < retries; i++) {\n    const res = await fetch(`/api/${path}?n=${i}`);\n    if (res.ok) return await res.text();\n  }\n  throw new Error("failed");\n}\n';
const prose = 'Some paragraph text with `inline code` and a [link](https://example.com).\n\n';
const page = Array.from({ length: 20 }, () => `${prose}\`\`\`ts\n${block}\`\`\`\n\n`).join('');
const PAGES = 50;

async function run(highlight) {
  const start = performance.now();
  for (let i = 0; i < PAGES; i++) await renderMarkdown(page.replaceAll("retries = 3", `retries = ${i}`), `page-${i}.md`, { highlight });
  return performance.now() - start;
}
function median(xs) { return xs.sort((a, b) => a - b)[xs.length >> 1]; }
async function measure(highlight) { await run(highlight); const xs = []; for (let i = 0; i < 7; i++) xs.push(await run(highlight)); return median(xs); }

const none = await measure(false);
const treeSitter = await measure({ engine: 'tree-sitter' });
const highlights = await measure({ engine: 'highlights' });
const blocks = Array.from({ length: PAGES * 20 }, () => block);
codeToTokens(block, { lang: 'ts', theme });
const s = performance.now(); for (const b of blocks) codeToTokens(b, { lang: 'ts', theme }); const tokenizeOnly = performance.now() - s;

const f = (n) => `${n.toFixed(1)} ms`;
console.log(`${PAGES} pages x 20 ts blocks, median of 7`);
console.log(`highlight: false                    ${f(none)}`);
console.log(`highlight: { engine: "tree-sitter" } ${f(treeSitter)}  (+${f(treeSitter - none)})`);
console.log(`highlight: { engine: "highlights" }  ${f(highlights)}  (+${f(highlights - none)})`);
console.log(`@pierre/highlights codeToTokens only ${f(tokenizeOnly)}`);
