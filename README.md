# ox-content: `engine: "highlights"` does not match the tree-sitter engine

Reproduction for ISSUE_LINK, using `@ox-content/vite-plugin@3.8.3` (which pulls in `@pierre/highlights@0.3.0`), `vite@8.3.8`, Node 24.22.2 and pnpm 12.20.0.

## Steps

```sh
pnpm install --frozen-lockfile
pnpm run repro:tree-sitter   # default engine
pnpm run repro               # HIGHLIGHTS=1 → highlight: { engine: "highlights" }
pnpm run bench
```

With `highlight: { engine: "highlights" }`, the output does not match the default tree-sitter engine in three ways. The engine is also missing from ox-content's own benchmarks, where it is about 6× slower than tree-sitter end to end.

Input (`input.md` in the repro):

````md
```fish
function greet
    set -l name (whoami)
    echo "hello $name"
end
```

```text
plain text block
```

```diff
-import foo from 'foo';
+import bar from 'bar';
 export default bar;
```
````

### 1. Languages Highlights does not support stay unhighlighted

`highlightWithHighlights` returns `null` when `isSupportedLanguage` is false, and nothing falls back to tree-sitter. `fish` has a native grammar, but with `engine: "highlights"` it is emitted as a bare `<pre><code>`. Choosing the faster engine therefore reduces language coverage.

### 2. `text` / `plain` blocks lose the `ox-highlight` wrapper

tree-sitter wraps a `text` block in `<pre class="ox-highlight css-variables" style="background-color:var(--octc-syntax-background)…">`. The Highlights path returns `null` for `text`, `plain`, `plaintext` and `txt`, so these blocks keep the original `<pre>`. They are styled differently from every other block on the page.

### 3. Some Highlights token kinds fall through to the foreground colour

`tokenColor` maps Highlights kinds with hand-written prefix regexes. `diff-plus` and `diff-minus` match none of them, so the added and removed lines of a diff get the foreground colour, even though Highlights classifies them. In a 67-post blog, `variable-special` (Zig) and `selector-pseudo` (HTML) fell through in the same way. Each new kind Highlights adds will fall through silently until the table is updated.

### Output (`pnpm run repro:tree-sitter` vs `pnpm run repro`)

```
engine: tree-sitter

fish: ox-highlight wrapper=true, colours=[foreground, token-keyword, token-function, token-punctuation, token-string, token-constant]
text: ox-highlight wrapper=true, colours=[foreground]
diff: ox-highlight wrapper=true, colours=[foreground, token-keyword, token-string], +/- line body colour=[token-keyword, token-string]
```

```
engine: highlights

fish: ox-highlight wrapper=false, colours=[]
text: ox-highlight wrapper=false, colours=[]
diff: ox-highlight wrapper=true, colours=[foreground, token-punctuation], +/- line body colour=[foreground, foreground]
```

### 4. Benchmarks do not cover the Highlights engine

`tools/benchmarks/pipeline-extensions.ts` calls `highlightCode` without options, and `tools/benchmarks/scale` uses `highlight: true`, so only tree-sitter is measured. Measuring the Highlights engine shows a large gap that the tokenizer does not explain (`pnpm run bench`, 50 pages × 20 TypeScript blocks, median of 7, Node 24.22.2, Apple Silicon macOS):

```
highlight: false                    3.1 ms
highlight: { engine: "tree-sitter" } 51.0 ms  (+47.9 ms)
highlight: { engine: "highlights" }  300.0 ms  (+296.9 ms)
@pierre/highlights codeToTokens only 3.5 ms
```

The tokenizer accounts for about 3.5 ms of the ~297 ms. Could the Highlights engine be added to `pipeline-extensions` and `scale`, so changes to it are measured the same way as tree-sitter?

## Analysis

Read at `ubugeeei-prod/ox-content@cbb3753` (`npm/vite-plugin-ox-content/src/`). Nothing here was patched and rebuilt, so these are hypotheses:

- Items 1 and 2: `highlight-highlights.ts:49-52` returns `null` for plain-text ids and unsupported languages. `highlightCode` passes that function to `rehypeCodeHighlight` instead of `highlightNatively`, so `null` means "leave the block as it is". A fallback to `highlightNatively` would keep coverage and the wrapper the same as the default engine.
- Item 3: `tokenColor` in `highlight-highlights.ts:23-41` has no case for `diff-*`, `variable-special` or `selector-pseudo`.
- Item 4: with `engine: "highlights"`, `highlightPageHtml` (`highlight.ts:178`) and `highlightCode` (`highlight.ts:155`) skip `highlightDocumentNatively`. They run the full unified/rehype parse and stringify for each page, plus a fragment parse of each highlighted block (`highlight.ts:46`). That walk is probably where most of the ~297 ms goes. I have not profiled it.

## How it was found

I compared both engines while evaluating `engine: "highlights"` for a personal blog with about 70 posts, built with `@ox-content/vite-plugin` 3.8.2. Its fish blocks lost highlighting, its `text` blocks lost the code-block background, and the build got about 3% slower with Highlights. The blog is not needed to reproduce any of this. The same results come from calling `renderMarkdown` on 3.8.3, as shown here.

## Files

- `input.md`: one `fish`, one `text` and one `diff` block.
- `repro.js`: renders `input.md` with `renderMarkdown`. `HIGHLIGHTS=1` switches from the default tree-sitter engine to `engine: "highlights"`. For each block it prints whether the `ox-highlight` wrapper is present and which colour variables are used.
- `bench.js`: times `renderMarkdown` with highlighting off, with tree-sitter, and with Highlights, and also times `@pierre/highlights` `codeToTokens` on its own.
