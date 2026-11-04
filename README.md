# Vue typecheck benchmark

A reproducible large-project benchmark for five Vue type-checking paths:

1. `vue-tsc` with TypeScript 6
2. Vue Language Tools' Content Mapper with TypeScript 7.1 (`tsc`)
3. Vue Language Tools' Content Mapper with `tsrs`
4. Vize's Content Mapper with TypeScript 7.1 (`tsc`)
5. Vize's Content Mapper with `tsrs`

Both `tsrs` paths are also measured with tsrs' opt-in `--fast` preset. Those two rows are reported
separately because `--fast` may diverge from the pinned TypeScript behavior.

The corpus contains 2,500 generated Vue SFCs connected as 20-component dependency DAG clusters.
Components exercise typed props, emits, slots, discriminated unions, exposed methods, and typed
`useTemplateRef()` access. Twelve intentional type-error sites are spread across `<script setup>` and
templates. Package versions are pinned in the lockfile.

## Run

Requirements: [Vite+](https://viteplus.dev/) 1.3.0.

```sh
vp install --frozen-lockfile
vp run verify
vp run benchmark
vp run benchmark:vize-checkers
```

`vp run verify` first requires an exact match on file, line, column, and TypeScript diagnostic code
for all twelve intentional errors, with zero extra diagnostics. The benchmark then performs no warmup
and five measured fresh-process runs per checker. Vite+ task caching, compiler incremental state,
Content Mapper caches, and `.tsbuildinfo` are not used. The operating system page cache is not
flushed. Commands are rotated between iterations to reduce order bias. Both raw samples and a
Markdown summary are written to `benchmark/results/`.

`vp run benchmark:vize-checkers` separately measures `vize check` with `--servers 1` fixed and
`--checkers 1,2,4,8`. Every fresh-process sample must pass the same exact diagnostic parity gate.
Keeping the Corsa process count fixed isolates checker-worker scaling instead of changing two
parallelism controls at once. `vize check` persists a virtual project and `.tsbuildinfo` under the
user cache directory, so every sample runs with a fresh, empty `HOME` to keep that state cold.
Override the matrix with, for example, `vp run benchmark:vize-checkers --checkers 1,2,3,4 --runs 3`.

Run an individual checker with Vite+:

```sh
vp run check:vue-tsc
vp run check:vue-tsgo
vp run check:vue-tsrs
vp run check:vize-tsgo
vp run check:vize-tsrs
vp run check:vue-tsrs-fast
vp run check:vize-tsrs-fast
```

The standalone `vize check` path is tracked separately because it is not a Content Mapper and can
serve projects before TypeScript 7.1:

```sh
vp run check:vize-cli
```

It is intentionally excluded from the five-way Content Mapper table so that unlike pipelines are
not presented as interchangeable.

## Recorded result

Apple M5 Pro, 48 GiB RAM, Node.js 26.12.1; zero warmups and five fresh-process runs:

| Checker                              |   Median |           Range | Speedup vs vue-tsc |
| ------------------------------------ | -------: | --------------: | -----------------: |
| Vize Content Mapper + tsrs           |  2.560 s |   2.488–2.859 s |              9.51x |
| Vue Content Mapper + tsrs            |  3.474 s |   3.260–3.913 s |              7.01x |
| Vue Content Mapper + TypeScript 7.1  |  4.521 s |   4.172–4.934 s |              5.38x |
| Vize Content Mapper + TypeScript 7.1 |  7.424 s |   7.187–9.096 s |              3.28x |
| vue-tsc + TypeScript 6               | 24.342 s | 22.659–25.477 s |              1.00x |

The same run measured both `tsrs` paths with `--fast`:

| Checker                    | Default | `--fast` | Speedup from `--fast` | Speedup vs vue-tsc |
| -------------------------- | ------: | -------: | --------------------: | -----------------: |
| Vize Content Mapper + tsrs | 2.560 s |  1.626 s |                 1.57x |             14.97x |
| Vue Content Mapper + tsrs  | 3.474 s |  3.275 s |                 1.06x |              7.43x |

See the [Markdown report](./benchmark/results/2026-11-04T04-47-22Z.md) and
[raw JSON](./benchmark/results/2026-11-04T04-47-22Z.json). Every measured invocation passed the
exact 12-diagnostic parity gate, including both `--fast` paths.

An [earlier run on the same day](./benchmark/results/2026-11-04T04-38-09Z.md) recorded 7–18% higher
medians for the multi-threaded checkers while `vue-tsc` moved by 1%, which points to CPU contention
during that run. The relative order and the Vize/Vue `tsrs` ratio (0.736 vs 0.737) were unchanged.

### `vize check` checker-worker scaling

With the same machine and corpus, fixing `--servers 1` and changing only `--checkers` produced:

| Checker workers per Corsa process |   Median |           Range | Speedup vs 1 checker |
| --------------------------------: | -------: | --------------: | -------------------: |
|                                 1 | 25.970 s | 24.742–26.199 s |                1.00x |
|                                 2 | 14.832 s | 13.973–16.685 s |                1.75x |
|                                 4 |  8.655 s |  8.304–10.284 s |                3.00x |
|                                 8 |  7.720 s |   7.190–8.860 s |                3.36x |

On the cold path, checker workers do scale: eight workers are 3.36x faster than one. Even then, the
standalone check remains 3.02x slower than Vize's Content Mapper on tsrs, and going from four to
eight workers gains only 1.12x, so serial preparation and the Corsa call boundary still need
profiling. See the [checker-scaling report](./benchmark/results/vize-checkers-2026-11-04T04-52-11Z.md)
and [raw JSON](./benchmark/results/vize-checkers-2026-11-04T04-52-11Z.json). Each of the 20 measured
invocations independently passed the exact 12-diagnostic parity gate.

The earlier [2026-10-27 report](./benchmark/results/vize-checkers-2026-10-27T11-09-51Z.md) showed no
scaling at about 3.6 s per run. Those runs reused the persisted Vize project and `.tsbuildinfo`
from earlier checks, so they measured a warm path and are superseded by the result above.

## Performance target

The long-term target is a complete cold check of the 2,500-SFC corpus in less than 500 ms, including
process startup and diagnostics. This repository records the end-to-end result. The corresponding
Vize work needs lower-level Rust benchmarks for file discovery and reads, SFC parsing, template AST
construction, virtual TypeScript generation, source-map lookup, dependency-graph construction, and
allocation counts/bytes. The target does not permit a daemon, incremental compiler state, or a
persisted mapper cache. Vize tracks the type-checker throughput work in
[`ubugeeei-prod/vize#7698`](https://github.com/ubugeeei-prod/vize/issues/7698).

`vue-tsc` and TypeScript 6 are isolated in
[`tools/vue-tsc/package.json`](./tools/vue-tsc/package.json), while the root project owns TypeScript
7.1, tsrs, and both Content Mappers. This keeps the incompatible TypeScript major versions in one
workspace without changing the benchmark corpus. Its Node.js process has an explicit 4 GiB old-space
limit so the same 2,500-SFC command works under Node.js 24 and 26.

To regenerate the checked-in corpus or change its size:

```sh
vp run generate
COMPONENT_COUNT=3000 vp run generate
```

## Configurations

- [`tsconfig.vue-tsc.json`](./tsconfig.vue-tsc.json) uses `vue-tsc@3.3.13` and TypeScript 6.0.3.
- [`tsconfig.vue-content-mapper.json`](./tsconfig.vue-content-mapper.json) selects
  `@vue/content-mapper@4.0.0-alpha.0`.
- [`tsconfig.vize-content-mapper.json`](./tsconfig.vize-content-mapper.json) selects
  `vize@0.679.0`.

Both Content Mapper configurations run unchanged on `typescript@7.1.0-beta` and
`tsrs@0.21.0-ts7.1.0-beta`; only the executable changes. The `--fast` rows add only that flag.

Content Mappers execute external programs, so the TypeScript and tsrs commands explicitly pass
`--runExternalCode`.

## Caveats

- This is a synthetic throughput benchmark, not a claim that every real project has the same shape.
- Content Mappers and Vue Language Tools v4 are beta/alpha software. Expect behavior and performance
  to change.
- The benchmark checks diagnostics rather than declaration emit or editor latency.
- Results are most useful when comparing all five commands on the same machine and checkout.
