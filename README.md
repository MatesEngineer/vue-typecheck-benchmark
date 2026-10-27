# Vue typecheck benchmark

A reproducible large-project benchmark for five Vue type-checking paths:

1. `vue-tsc` with TypeScript 6
2. Vue Language Tools' Content Mapper with TypeScript 7.1 (`tsc`)
3. Vue Language Tools' Content Mapper with `tsrs`
4. Vize's Content Mapper with TypeScript 7.1 (`tsc`)
5. Vize's Content Mapper with `tsrs`

The corpus contains 5,000 generated Vue SFCs and six intentional type-error sites spread across
`<script setup>` and templates. Package versions are pinned in the lockfile.

## Recorded result

The first recorded run on an Apple M5 Pro found Vize + tsrs fastest at a 6.039 s median, 4.57x
faster than the 27.599 s `vue-tsc` median. See the
[full table and environment](./benchmark/results/2026-10-27T09-35-02Z.md) and
[raw samples](./benchmark/results/2026-10-27T09-35-02Z.json).

## Run

Requirements: Node.js 24 or newer and pnpm 11.5.0.

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm benchmark
```

`pnpm verify` first confirms that every checker finds all six intentional error sites. The benchmark
then performs one warmup and five measured fresh-process runs per checker. Commands are rotated
between iterations to reduce order bias. Both raw samples and a Markdown summary are written to
`benchmark/results/`.

To regenerate the checked-in corpus or change its size:

```sh
pnpm generate
COMPONENT_COUNT=10000 pnpm generate
```

## Configurations

- [`tsconfig.vue-tsc.json`](./tsconfig.vue-tsc.json) uses `vue-tsc@3.3.13` and TypeScript 6.0.3.
- [`tsconfig.vue-content-mapper.json`](./tsconfig.vue-content-mapper.json) selects
  `@vue/content-mapper@4.0.0-alpha.0`.
- [`tsconfig.vize-content-mapper.json`](./tsconfig.vize-content-mapper.json) selects
  `vize@0.595.0`.

Both Content Mapper configurations run unchanged on `typescript@7.1.0-beta` and
`tsrs@0.20.0-ts7.1.0-beta`; only the executable changes.

Content Mappers execute external programs, so the TypeScript and tsrs commands explicitly pass
`--runExternalCode`.

## Caveats

- This is a synthetic throughput benchmark, not a claim that every real project has the same shape.
- Content Mappers and Vue Language Tools v4 are beta/alpha software. Expect behavior and performance
  to change.
- The benchmark checks diagnostics rather than declaration emit or editor latency.
- Results are most useful when comparing all five commands on the same machine and checkout.
