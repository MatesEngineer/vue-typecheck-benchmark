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

Apple M5 Pro, 48 GiB RAM, Node.js 26.13.0, `vize@0.742.0`, `@vue/content-mapper@4.0.0-alpha.3`,
`tsrs@0.24.0-ts7.1.0-beta`, `vue-tsc@3.3.14`; zero warmups and five fresh-process runs:

| Checker                              |   Median |           Range | Speedup vs vue-tsc |
| ------------------------------------ | -------: | --------------: | -----------------: |
| Vize Content Mapper + tsrs           |  1.233 s |   1.213–1.463 s |             20.27x |
| Vize Content Mapper + TypeScript 7.1 |  3.403 s |   3.099–3.765 s |              7.34x |
| Vue Content Mapper + tsrs            |  5.847 s |   5.735–6.778 s |              4.27x |
| Vue Content Mapper + TypeScript 7.1  |  7.049 s |   6.804–7.341 s |              3.54x |
| vue-tsc + TypeScript 6               | 24.987 s | 23.855–25.027 s |              1.00x |

The same run measured both `tsrs` paths with `--fast`:

| Checker                    | Default | `--fast` | Speedup from `--fast` | Speedup vs vue-tsc |
| -------------------------- | ------: | -------: | --------------------: | -----------------: |
| Vize Content Mapper + tsrs | 1.233 s |  0.914 s |                 1.35x |             27.33x |
| Vue Content Mapper + tsrs  | 5.847 s |  5.540 s |                 1.06x |              4.51x |

See the [Markdown report](./benchmark/results/2026-11-11T07-50-42Z.md) and
[raw JSON](./benchmark/results/2026-11-11T07-50-42Z.json). Every measured invocation passed the
exact 12-diagnostic parity gate, including both `--fast` paths.

The run started after the machine went quiet (load average below 4). Other processes used 0.69 CPU
cores on average during this timing run. The Vize `--fast` range (0.853–1.068 s) does not overlap
its default range (1.213–1.463 s). Vue's `--fast` median is 1.06x faster than its default, but those
ranges overlap (5.424–5.977 s and 5.735–6.778 s).

The previous [2026-11-10 report](./benchmark/results/2026-11-10T12-20-09Z.md), also taken on a quiet
machine with `vize@0.732.0`, `tsrs@0.23.0-ts7.1.0-beta`, and `vue-tsc@3.3.13`, recorded Vize +
TypeScript 7.1 at 4.638 s (4.334–5.498 s) and Vize + tsrs at 1.715 s (1.581–1.762 s). Neither pair
of ranges overlaps this run's, so these paths are 1.36x and 1.39x faster. TypeScript 7.1 did not
change between the runs, so the TypeScript 7.1 gain comes from Vize; the tsrs gain also includes
the tsrs 0.24.0 update. The Vue Content Mapper and vue-tsc rows stayed within overlapping ranges.
Against the [2026-11-09 report](./benchmark/results/2026-11-09T11-26-24Z.md) with `vize@0.718.0`,
Vize + tsrs is 3.53x faster and Vize + TypeScript 7.1 is 2.59x faster.

`@vue/content-mapper@4.0.0-alpha.3` measured slower than alpha.0. Runs on 2026-11-10 with alpha.0
and tsrs 0.23.0, taken with more external load, recorded Vue + tsrs at 3.735 s
([2026-11-10T08-38-55Z.md](./benchmark/results/2026-11-10T08-38-55Z.md)) and 4.610 s
([2026-11-10T11-42-10Z.md](./benchmark/results/2026-11-10T11-42-10Z.md)), against 5.953 s for
alpha.3 in the quiet 2026-11-10 run. Part of the Vize/Vue gap in this table comes from the Vue
mapper update.

### `vize check` checker-worker scaling

With the same machine and corpus, fixing `--servers 1` and changing only `--checkers` produced:

| Checker workers per Corsa process |  Median |         Range | Speedup vs 1 checker |
| --------------------------------: | ------: | ------------: | -------------------: |
|                                 1 | 5.033 s | 4.776–5.333 s |                1.00x |
|                                 2 | 3.519 s | 3.440–3.689 s |                1.43x |
|                                 4 | 2.742 s | 2.632–2.894 s |                1.84x |
|                                 8 | 2.314 s | 2.260–2.425 s |                2.18x |

On the cold path, eight workers are 2.18x faster than one. Even then, the standalone check remains
1.88x slower than the Vize Content Mapper + tsrs median from the timing run immediately before it,
and going from four to eight workers gains only 1.18x, so serial preparation and the Corsa call
boundary still need profiling. Other processes used 1.19 CPU cores on average during this run. See
the [checker-scaling report](./benchmark/results/vize-checkers-2026-11-11T07-51-53Z.md) and
[raw JSON](./benchmark/results/vize-checkers-2026-11-11T07-51-53Z.json). Each of the 20 measured
invocations independently passed the exact 12-diagnostic parity gate. With `vize@0.732.0`, the
[2026-11-10 report](./benchmark/results/vize-checkers-2026-11-10T12-22-57Z.md) recorded 14.150 s
with one checker and 4.745 s with eight; with `vize@0.718.0`, the
[2026-11-09 report](./benchmark/results/vize-checkers-2026-11-09T11-30-59Z.md) recorded 24.163 s
and 6.808 s.

The earlier [2026-10-27 report](./benchmark/results/vize-checkers-2026-10-27T11-09-51Z.md) showed no
scaling at about 3.6 s per run. Those runs reused the persisted Vize project and `.tsbuildinfo`
from earlier checks, so they measured a warm path and are superseded by the cold results.

### Peak memory

With the same versions, `vp run benchmark:memory` recorded the following peak RSS of each process
tree (median of three runs):

| Checker                              | Peak tree RSS | Largest process | Processes | vs vue-tsc |
| ------------------------------------ | ------------: | --------------: | --------: | ---------: |
| `vize check` (8 checkers)            |      1.23 GiB |        0.98 GiB |         2 |      0.33x |
| `vize check` (1 checker)             |      1.26 GiB |        1.01 GiB |         2 |      0.34x |
| Vize Content Mapper + tsrs `--fast`  |      1.27 GiB |        1.19 GiB |         2 |      0.34x |
| `vize check` (2 checkers)            |      1.28 GiB |        1.03 GiB |         4 |      0.35x |
| `vize check` (4 checkers)            |      1.29 GiB |        1.04 GiB |         2 |      0.35x |
| Vize Content Mapper + tsrs           |      1.44 GiB |        1.37 GiB |         2 |      0.39x |
| Vue Content Mapper + tsrs `--fast`   |      1.54 GiB |        0.96 GiB |         3 |      0.42x |
| Vue Content Mapper + tsrs            |      1.74 GiB |        0.98 GiB |         3 |      0.47x |
| Vue Content Mapper + TypeScript 7.1  |      2.63 GiB |        1.65 GiB |         3 |      0.71x |
| Vize Content Mapper + TypeScript 7.1 |      2.91 GiB |        2.83 GiB |         2 |      0.79x |
| vue-tsc + TypeScript 6               |      3.69 GiB |        3.69 GiB |         1 |      1.00x |

On tsrs, Vize now peaks below Vue (1.44 GiB and 1.74 GiB), but the split differs. Vue's tsrs process
peaks at 0.98 GiB, and its separate Node.js mapper processes add about 0.77 GiB. Vize's mapper is
light, so almost all memory is in the tsrs process, which peaks at 1.40x Vue's tsrs process. On
TypeScript 7.1 that compiler-side difference shows directly: Vize uses 1.10x the peak of Vue's
mapper. `vize check` now peaks at about 1.2–1.3 GiB at every checker count, down from 3.20–3.64 GiB
with `vize@0.732.0` in the
[2026-11-10 memory report](./benchmark/results/memory-2026-11-10T12-27-24Z.md). Other processes used
2.64 CPU cores on average during this run. See the
[memory report](./benchmark/results/memory-2026-11-11T07-56-01Z.md) and
[raw JSON](./benchmark/results/memory-2026-11-11T07-56-01Z.json).

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

- [`tsconfig.vue-tsc.json`](./tsconfig.vue-tsc.json) uses `vue-tsc@3.3.14` and TypeScript 6.0.3.
- [`tsconfig.vue-content-mapper.json`](./tsconfig.vue-content-mapper.json) selects
  `@vue/content-mapper@4.0.0-alpha.3`.
- [`tsconfig.vize-content-mapper.json`](./tsconfig.vize-content-mapper.json) selects
  `vize@0.742.0`.

Both Content Mapper configurations run unchanged on `typescript@7.1.0-beta` and
`tsrs@0.24.0-ts7.1.0-beta`; only the executable changes. The `--fast` rows add only that flag.

Content Mappers execute external programs, so the TypeScript and tsrs commands explicitly pass
`--runExternalCode`.

## Caveats

- This is a synthetic throughput benchmark, not a claim that every real project has the same shape.
- Content Mappers and Vue Language Tools v4 are beta/alpha software. Expect behavior and performance
  to change.
- The benchmark checks diagnostics rather than declaration emit or editor latency.
- Results are most useful when comparing all five commands on the same machine and checkout.
