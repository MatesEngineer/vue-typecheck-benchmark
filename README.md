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

Apple M5 Pro, 48 GiB RAM, Node.js 26.13.0, `vize@0.743.0`, `@vue/content-mapper@4.0.0-alpha.3`,
`tsrs@0.24.0-ts7.1.0-beta`, `vue-tsc@3.3.14`; zero warmups and five fresh-process runs:

| Checker                              |   Median |           Range | Speedup vs vue-tsc |
| ------------------------------------ | -------: | --------------: | -----------------: |
| Vize Content Mapper + tsrs           |  1.119 s |   1.113–1.226 s |             20.58x |
| Vize Content Mapper + TypeScript 7.1 |  3.132 s |   2.900–3.245 s |              7.35x |
| Vue Content Mapper + tsrs            |  5.604 s |   5.457–5.816 s |              4.11x |
| Vue Content Mapper + TypeScript 7.1  |  6.638 s |   6.542–6.676 s |              3.47x |
| vue-tsc + TypeScript 6               | 23.035 s | 22.584–23.364 s |              1.00x |

The same run measured both `tsrs` paths with `--fast`:

| Checker                    | Default | `--fast` | Speedup from `--fast` | Speedup vs vue-tsc |
| -------------------------- | ------: | -------: | --------------------: | -----------------: |
| Vize Content Mapper + tsrs | 1.119 s |  0.805 s |                 1.39x |             28.61x |
| Vue Content Mapper + tsrs  | 5.604 s |  5.329 s |                 1.05x |              4.32x |

See the [Markdown report](./benchmark/results/2026-11-11T11-23-25Z.md) and
[raw JSON](./benchmark/results/2026-11-11T11-23-25Z.json). Every measured invocation passed the
exact 12-diagnostic parity gate, including both `--fast` paths.

The run started after the machine went quiet (load average below 4). Other processes used 0.33 CPU
cores on average during this timing run. The Vize `--fast` range (0.605–0.845 s) does not overlap
its default range (1.113–1.226 s). Vue's `--fast` median is 1.05x faster than its default, but
those ranges overlap (5.181–5.472 s and 5.457–5.816 s).

Compared with the [`vize@0.742.0` report](./benchmark/results/2026-11-11T07-50-42Z.md) from earlier
the same day, every row got 4–14% faster, including vue-tsc (1.09x) and the Vue Content Mapper rows
(1.04–1.06x), whose packages did not change. The Vize Content Mapper rows moved by a similar amount
(1.10x with tsrs and 1.09x with TypeScript 7.1) and their ranges overlap, so this run does not show a
Content Mapper speedup from `vize@0.743.0` beyond run-to-run variation.

Against the quiet [2026-11-10 report](./benchmark/results/2026-11-10T12-20-09Z.md) with
`vize@0.732.0`, `tsrs@0.23.0-ts7.1.0-beta`, and `vue-tsc@3.3.13`, Vize + TypeScript 7.1 is 1.48x
faster (4.638 s, 4.334–5.498 s) and Vize + tsrs is 1.53x faster (1.715 s, 1.581–1.762 s), with no
range overlap. Vue Content Mapper + TypeScript 7.1 moved only 1.03x over the same span, so the
TypeScript 7.1 gain comes mostly from Vize; the tsrs gain also includes the tsrs 0.24.0 update.
Against the [2026-11-09 report](./benchmark/results/2026-11-09T11-26-24Z.md) with `vize@0.718.0`,
Vize + tsrs is 3.89x faster and Vize + TypeScript 7.1 is 2.82x faster.

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
|                                 1 | 3.764 s | 3.709–3.935 s |                1.00x |
|                                 2 | 2.385 s | 2.328–2.645 s |                1.58x |
|                                 4 | 1.688 s | 1.663–1.806 s |                2.23x |
|                                 8 | 1.358 s | 1.310–1.462 s |                2.77x |

On the cold path, eight workers are 2.77x faster than one. The standalone check is now 1.21x
slower than the Vize Content Mapper + tsrs median from the timing run immediately before it, and
going from four to eight workers gains 1.24x. Against the
[`vize@0.742.0` report](./benchmark/results/vize-checkers-2026-11-11T07-51-53Z.md), eight workers
went from 2.314 s to 1.358 s (1.70x) and one worker from 5.033 s to 3.764 s (1.34x), with no range
overlap. That is larger than the 1.09x shift of the unchanged vue-tsc row between the two timing
runs. Other processes used 0.80 CPU cores on average during this run. See the
[checker-scaling report](./benchmark/results/vize-checkers-2026-11-11T11-24-15Z.md) and
[raw JSON](./benchmark/results/vize-checkers-2026-11-11T11-24-15Z.json). Each of the 20 measured
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
| `vize check` (8 checkers)            |      1.22 GiB |        0.97 GiB |         2 |      0.32x |
| Vize Content Mapper + tsrs `--fast`  |      1.24 GiB |        1.17 GiB |         2 |      0.33x |
| `vize check` (4 checkers)            |      1.26 GiB |        1.00 GiB |         2 |      0.33x |
| `vize check` (1 checker)             |      1.26 GiB |        1.01 GiB |         2 |      0.33x |
| `vize check` (2 checkers)            |      1.26 GiB |        1.01 GiB |         2 |      0.34x |
| Vize Content Mapper + tsrs           |      1.45 GiB |        1.37 GiB |         2 |      0.39x |
| Vue Content Mapper + tsrs `--fast`   |      1.64 GiB |        1.01 GiB |         3 |      0.44x |
| Vue Content Mapper + tsrs            |      1.78 GiB |        0.99 GiB |         3 |      0.47x |
| Vue Content Mapper + TypeScript 7.1  |      2.69 GiB |        1.66 GiB |         3 |      0.71x |
| Vize Content Mapper + TypeScript 7.1 |      3.03 GiB |        2.95 GiB |         2 |      0.80x |
| vue-tsc + TypeScript 6               |      3.76 GiB |        3.76 GiB |         1 |      1.00x |

On tsrs, Vize peaks below Vue (1.45 GiB and 1.78 GiB), but the split differs. Vue's tsrs process
peaks at 0.99 GiB, and its separate Node.js mapper processes add about 0.79 GiB. Vize's mapper is
light, so almost all memory is in the tsrs process, which peaks at 1.39x Vue's tsrs process. On
TypeScript 7.1 that compiler-side difference shows directly: Vize uses 1.13x the peak of Vue's
mapper. `vize check` peaks at about 1.2–1.3 GiB at every checker count, down from 3.20–3.64 GiB
with `vize@0.732.0` in the
[2026-11-10 memory report](./benchmark/results/memory-2026-11-10T12-27-24Z.md). Other processes used
0.32 CPU cores on average during this run. See the
[memory report](./benchmark/results/memory-2026-11-11T11-27-05Z.md) and
[raw JSON](./benchmark/results/memory-2026-11-11T11-27-05Z.json).

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
  `vize@0.743.0`.

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
