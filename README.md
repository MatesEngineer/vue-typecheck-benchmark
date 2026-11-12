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

Apple M5 Pro, 48 GiB RAM, Node.js 26.13.0, `vize@0.746.0`, `@vue/content-mapper@4.0.0-alpha.3`,
`tsrs@0.25.0-ts7.1.0-beta`, `vue-tsc@3.3.14`; zero warmups and five fresh-process runs:

| Checker                              |   Median |           Range | Speedup vs vue-tsc |
| ------------------------------------ | -------: | --------------: | -----------------: |
| Vize Content Mapper + tsrs           |  1.143 s |   1.076–1.450 s |             20.88x |
| Vize Content Mapper + TypeScript 7.1 |  3.384 s |   3.119–3.653 s |              7.05x |
| Vue Content Mapper + tsrs            |  5.889 s |   5.422–6.132 s |              4.05x |
| Vue Content Mapper + TypeScript 7.1  |  7.420 s |   6.551–7.993 s |              3.21x |
| vue-tsc + TypeScript 6               | 23.852 s | 23.495–25.307 s |              1.00x |

The same run measured both `tsrs` paths with `--fast`:

| Checker                    | Default | `--fast` | Speedup from `--fast` | Speedup vs vue-tsc |
| -------------------------- | ------: | -------: | --------------------: | -----------------: |
| Vize Content Mapper + tsrs | 1.143 s |  0.861 s |                 1.33x |             27.69x |
| Vue Content Mapper + tsrs  | 5.889 s |  5.791 s |                 1.02x |              4.12x |

See the [Markdown report](./benchmark/results/2026-11-12T04-05-05Z.md) and
[raw JSON](./benchmark/results/2026-11-12T04-05-05Z.json). Every measured invocation passed the
exact 12-diagnostic parity gate, including both `--fast` paths.

The run started after the machine went quiet (load average below 4), and other processes used 0.78
CPU cores on average. The report keeps every sample and uses the median; compare the ranges and raw
JSON rather than the fastest sample alone. The Vize `--fast` median remained below one second, and
its range (0.552–0.955 s) does not overlap the default range. The Vue `--fast` and default ranges
overlap.

### `vize check` checker-worker scaling

With the same machine and corpus, fixing `--servers 1` and changing only `--checkers` produced:

| Checker workers per Corsa process |  Median |         Range | Speedup vs 1 checker |
| --------------------------------: | ------: | ------------: | -------------------: |
|                                 1 | 3.552 s | 3.541–4.211 s |                1.00x |
|                                 2 | 2.302 s | 2.263–2.373 s |                1.54x |
|                                 4 | 1.671 s | 1.621–1.794 s |                2.13x |
|                                 8 | 1.437 s | 1.299–1.726 s |                2.47x |

On the cold path, eight workers are 2.47x faster than one. Other processes used 0.44 CPU cores on
average. See the [checker-scaling report](./benchmark/results/vize-checkers-2026-11-12T04-05-54Z.md)
and [raw JSON](./benchmark/results/vize-checkers-2026-11-12T04-05-54Z.json). Each of the 20 measured
invocations independently passed the exact 12-diagnostic parity gate.

### Peak memory

With the same versions, `vp run benchmark:memory` recorded the following peak RSS of each process
tree (median of three runs):

| Checker                              | Peak tree RSS | Largest process | Processes | vs vue-tsc |
| ------------------------------------ | ------------: | --------------: | --------: | ---------: |
| Vize Content Mapper + tsrs `--fast`  |      1.19 GiB |        1.18 GiB |         2 |      0.32x |
| Vize Content Mapper + tsrs           |      1.43 GiB |        1.36 GiB |         2 |      0.38x |
| Vue Content Mapper + tsrs `--fast`   |      1.62 GiB |        0.98 GiB |         3 |      0.43x |
| Vue Content Mapper + tsrs            |      1.77 GiB |        0.99 GiB |         3 |      0.47x |
| Vue Content Mapper + TypeScript 7.1  |      2.64 GiB |        1.66 GiB |         3 |      0.71x |
| Vize Content Mapper + TypeScript 7.1 |      2.75 GiB |        2.67 GiB |         2 |      0.73x |
| vue-tsc + TypeScript 6               |      3.74 GiB |        3.74 GiB |         1 |      1.00x |

Vize + tsrs `--fast` used 1.19 GiB, 68% less than vue-tsc and 27% less than Vue Content Mapper +
tsrs `--fast`. Other processes used 0.53 CPU cores on average. See the
[memory report](./benchmark/results/memory-2026-11-12T04-08-50Z.md) and
[raw JSON](./benchmark/results/memory-2026-11-12T04-08-50Z.json).

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
  `vize@0.746.0`.

Both Content Mapper configurations run unchanged on `typescript@7.1.0-beta` and
`tsrs@0.25.0-ts7.1.0-beta`; only the executable changes. The `--fast` rows add only that flag.

Content Mappers execute external programs, so the TypeScript and tsrs commands explicitly pass
`--runExternalCode`.

## Caveats

- This is a synthetic throughput benchmark, not a claim that every real project has the same shape.
- Content Mappers and Vue Language Tools v4 are beta/alpha software. Expect behavior and performance
  to change.
- The benchmark checks diagnostics rather than declaration emit or editor latency.
- Results are most useful when comparing all five commands on the same machine and checkout.
