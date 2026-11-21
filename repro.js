import { readFileSync } from 'node:fs';
import { renderMarkdown } from '@ox-content/vite-plugin';

const engine = process.env.HIGHLIGHTS ? 'highlights' : 'tree-sitter';
const { html } = await renderMarkdown(readFileSync('input.md', 'utf8'), 'input.md', {
  highlight: { engine },
});

console.log(`engine: ${engine}\n`);
for (const pre of html.match(/<pre[\s\S]*?<\/pre>/g)) {
  const lang = pre.match(/language-(\w+)|data-language="(\w+)"/)?.slice(1).find(Boolean);
  const wrapped = pre.includes('ox-highlight');
  const colours = new Set([...pre.matchAll(/--octc-syntax-(token-[\w-]+|foreground)/g)].map((m) => m[1]));
  const diffLines = [...pre.matchAll(/<span class="line">([\s\S]*?)<\/span>(?=\n|<\/code>)/g)]
    .filter((m) => /^<span[^>]*>[+-]/.test(m[1]))
    .map((m) => [...m[1].matchAll(/--octc-syntax-(token-[\w-]+|foreground)/g)].map((c) => c[1]).at(-1));
  console.log(`${lang}: ox-highlight wrapper=${wrapped}, colours=[${[...colours].join(', ')}]${lang === 'diff' ? `, +/- line body colour=[${diffLines.join(', ')}]` : ''}`);
}
