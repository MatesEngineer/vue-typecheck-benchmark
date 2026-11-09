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
vp run benchmark:memory
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

`vp run benchmark:memory` measures peak memory separately from wall time. Content Mappers run as
child processes, so it samples the resident set size (RSS) of the whole spawned process tree with
`ps` every 100 ms and records both the peak tree total and the largest single process. It runs the
seven checker commands and `vize check` with `--checkers 1,2,4,8` three times each, and every sample
must pass the same diagnostic parity gate. RSS counts shared pages once per process, so the totals
are a comparison aid rather than exact physical memory. Use `--runs`, `--interval`, and
`--vize-checkers 1,8` or `--vize-checkers none` to change the matrix.

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

Apple M5 Pro, 48 GiB RAM, Node.js 26.13.0, `vize@0.718.0`, `tsrs@0.23.0-ts7.1.0-beta`; zero warmups
and five fresh-process runs:

| Checker                              |   Median |           Range | Speedup vs vue-tsc |
| ------------------------------------ | -------: | --------------: | -----------------: |
| Vize Content Mapper + tsrs           |  4.357 s |   2.727–4.740 s |              6.26x |
| Vue Content Mapper + tsrs            |  4.799 s |   3.522–7.204 s |              5.68x |
| Vue Content Mapper + TypeScript 7.1  |  5.857 s |   5.387–8.648 s |              4.66x |
| Vize Content Mapper + TypeScript 7.1 |  8.827 s |  8.122–12.521 s |              3.09x |
| vue-tsc + TypeScript 6               | 27.273 s | 24.015–36.867 s |              1.00x |

The same run measured both `tsrs` paths with `--fast`:

| Checker                    | Default | `--fast` | Speedup from `--fast` | Speedup vs vue-tsc |
| -------------------------- | ------: | -------: | --------------------: | -----------------: |
| Vize Content Mapper + tsrs | 4.357 s |  2.173 s |                 2.01x |             12.55x |
| Vue Content Mapper + tsrs  | 4.799 s |  5.253 s |                 0.91x |              5.19x |

See the [Markdown report](./benchmark/results/2026-11-09T11-26-24Z.md) and
[raw JSON](./benchmark/results/2026-11-09T11-26-24Z.json). Every measured invocation passed the
exact 12-diagnostic parity gate, including both `--fast` paths.

Other processes used 0.93 CPU cores on average across this timing run and the checker and memory
runs below. The wall-clock ranges are wide: Vize + tsrs spans 2.727–4.740 s, so the median is not a
tight estimate. Vue's `--fast` median is slower than its default, but the ranges overlap
(3.364–6.137 s and 3.522–7.204 s), so that pair does not show a `--fast` regression. The
[2026-11-04 report](./benchmark/results/2026-11-04T04-47-22Z.md) with `vize@0.679.0` and
`tsrs@0.21.0-ts7.1.0-beta` recorded the same default-mode order at 2.560 s for Vize + tsrs. Vize +
tsrs `--fast` measured 1.626 s then. A same-day `vize@0.717.0` run on a quieter machine
(0.42 external cores) is in
[2026-11-09T04-21-27Z.md](./benchmark/results/2026-11-09T04-21-27Z.md); its Vize + tsrs median was
2.543 s, inside this run's range.

### `vize check` checker-worker scaling

With the same machine and corpus, fixing `--servers 1` and changing only `--checkers` produced:

| Checker workers per Corsa process |   Median |           Range | Speedup vs 1 checker |
| --------------------------------: | -------: | --------------: | -------------------: |
|                                 1 | 24.163 s | 24.019–26.239 s |                1.00x |
|                                 2 | 13.520 s | 13.293–13.932 s |                1.79x |
|                                 4 |  8.263 s |  8.159–12.204 s |                2.92x |
|                                 8 |  6.808 s |   6.512–7.783 s |                3.55x |

On the cold path, checker workers do scale: eight workers are 3.55x faster than one. Even then, the
standalone check remains 1.56x slower than the same day's Vize Content Mapper + tsrs median, and
going from four to eight workers gains only 1.21x, so serial preparation and the Corsa call
boundary still need profiling. See the
[checker-scaling report](./benchmark/results/vize-checkers-2026-11-09T11-30-59Z.md) and
[raw JSON](./benchmark/results/vize-checkers-2026-11-09T11-30-59Z.json). Each of the 20 measured
invocations independently passed the exact 12-diagnostic parity gate.

The earlier [2026-10-27 report](./benchmark/results/vize-checkers-2026-10-27T11-09-51Z.md) showed no
scaling at about 3.6 s per run. Those runs reused the persisted Vize project and `.tsbuildinfo`
from earlier checks, so they measured a warm path and are superseded by the cold results.

### Peak memory

With the same versions, `vp run benchmark:memory` recorded the following peak RSS of each process
tree (median of three runs):

| Checker                              | Peak tree RSS | Largest process | Processes | vs vue-tsc |
| ------------------------------------ | ------------: | --------------: | --------: | ---------: |
| Vue Content Mapper + tsrs `--fast`   |      2.03 GiB |        1.41 GiB |         6 |      0.55x |
| Vize Content Mapper + tsrs `--fast`  |      2.08 GiB |        2.00 GiB |         2 |      0.56x |
| Vize Content Mapper + tsrs           |      2.30 GiB |        2.23 GiB |         2 |      0.63x |
| Vue Content Mapper + tsrs            |      2.31 GiB |        1.42 GiB |         6 |      0.63x |
| Vue Content Mapper + TypeScript 7.1  |      3.39 GiB |        1.77 GiB |         6 |      0.92x |
| vue-tsc + TypeScript 6               |      3.68 GiB |        3.68 GiB |         1 |      1.00x |
| `vize check` (1 checker)             |      4.88 GiB |        4.58 GiB |         2 |      1.33x |
| `vize check` (2 checkers)            |      5.10 GiB |        4.80 GiB |         2 |      1.39x |
| `vize check` (4 checkers)            |      5.17 GiB |        4.87 GiB |         2 |      1.41x |
| Vize Content Mapper + TypeScript 7.1 |      5.27 GiB |        5.20 GiB |         2 |      1.43x |
| `vize check` (8 checkers)            |      5.59 GiB |        5.29 GiB |         2 |      1.52x |

On tsrs, both mappers peak at about the same total, but the split differs. Vue's mapper side runs
in separate Node.js processes, while Vize's mapper is light and almost all memory is in the tsrs
process. On TypeScript 7.1 that difference shows directly: Vize uses 1.55x the peak of Vue's mapper.
See the [memory report](./benchmark/results/memory-2026-11-09T11-36-53Z.md) and
[raw JSON](./benchmark/results/memory-2026-11-09T11-36-53Z.json).

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
  `vize@0.718.0`.

Both Content Mapper configurations run unchanged on `typescript@7.1.0-beta` and
`tsrs@0.23.0-ts7.1.0-beta`; only the executable changes. The `--fast` rows add only that flag.

Content Mappers execute external programs, so the TypeScript and tsrs commands explicitly pass
`--runExternalCode`.

## Caveats

- This is a synthetic throughput benchmark, not a claim that every real project has the same shape.
- Content Mappers and Vue Language Tools v4 are beta/alpha software. Expect behavior and performance
  to change.
- The benchmark checks diagnostics rather than declaration emit or editor latency.
- Results are most useful when comparing all five commands on the same machine and checkout.
