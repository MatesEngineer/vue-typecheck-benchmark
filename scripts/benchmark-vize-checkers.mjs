import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { cpus, freemem, hostname, platform, release, totalmem } from "node:os";
import { join } from "node:path";
import { root } from "./commands.mjs";
import { assertExactVizeDiagnostics, expectedDiagnostics } from "./diagnostics.mjs";

const readNumberArgument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? fallback : Number.parseInt(process.argv[index + 1] ?? "", 10);
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${name} must be a positive integer`);
  return value;
};

const readCheckerCounts = () => {
  const index = process.argv.indexOf("--checkers");
  const input = index === -1 ? "1,2,4,8" : (process.argv[index + 1] ?? "");
  const values = input.split(",").map((value) => Number.parseInt(value, 10));
  if (values.length === 0 || values.some((value) => !Number.isSafeInteger(value) || value < 1)) {
    throw new Error("--checkers must be a comma-separated list of positive integers");
  }
  return [...new Set(values)];
};

const iterations = readNumberArgument("--runs", 5);
const warmups = readNumberArgument("--warmup", 0);
const servers = readNumberArgument("--servers", 1);
const checkerCounts = readCheckerCounts();
if (iterations < 1) throw new Error("--runs must be at least 1");
if (servers < 1) throw new Error("--servers must be at least 1");

const binSuffix = process.platform === "win32" ? ".cmd" : "";
const executable = `node_modules/.bin/vize${binSuffix}`;

function run(checkers) {
  const args = [
    "check",
    "--tsconfig",
    "tsconfig.base.json",
    "--format",
    "text",
    "--servers",
    String(servers),
    "--checkers",
    String(checkers),
  ];
  const start = process.hrtime.bigint();
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
  if (result.error) throw result.error;
  const output = `${result.stdout}\n${result.stderr}`;
  assertExactVizeDiagnostics(output, result.status, result.signal);
  return durationMs;
}

for (let warmup = 0; warmup < warmups; warmup += 1) {
  for (const checkers of checkerCounts) {
    process.stdout.write(`Warmup ${warmup + 1}/${warmups}: checkers=${checkers}\r`);
    run(checkers);
  }
}
process.stdout.write(" ".repeat(80) + "\r");

const samples = Object.fromEntries(checkerCounts.map((checkers) => [checkers, []]));
for (let iteration = 0; iteration < iterations; iteration += 1) {
  const rotated = checkerCounts
    .slice(iteration % checkerCounts.length)
    .concat(checkerCounts.slice(0, iteration % checkerCounts.length));
  for (const checkers of rotated) {
    process.stdout.write(`Run ${iteration + 1}/${iterations}: checkers=${checkers}... `);
    const durationMs = run(checkers);
    samples[checkers].push(durationMs);
    console.log(`${(durationMs / 1000).toFixed(3)} s`);
  }
}

const percentile = (values, ratio) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) * ratio)];
};

const results = checkerCounts.map((checkers) => {
  const values = samples[checkers];
  const meanMs = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - meanMs) ** 2, 0) / values.length;
  return {
    checkers,
    samplesMs: values,
    meanMs,
    medianMs: percentile(values, 0.5),
    minMs: Math.min(...values),
    maxMs: Math.max(...values),
    standardDeviationMs: Math.sqrt(variance),
  };
});

const baseline = results.find((result) => result.checkers === checkerCounts[0]).medianMs;
const componentCount = readdirSync(join(root, "src", "generated")).filter((file) =>
  file.endsWith(".vue"),
).length;
const environment = {
  timestamp: new Date().toISOString(),
  hostname: hostname(),
  platform: `${platform()} ${release()}`,
  cpu: cpus()[0]?.model ?? "unknown",
  logicalCpus: cpus().length,
  totalMemoryBytes: totalmem(),
  freeMemoryBytesAtReport: freemem(),
  node: process.version,
  componentCount,
  intentionalErrorSites: expectedDiagnostics.length,
  vizeServers: servers,
  checkerCounts,
  cachePolicy:
    "fresh process; no compiler, mapper, task, or tsbuildinfo cache; OS page cache not flushed",
  warmups,
  iterations,
};

const report = { environment, results };
const outputDirectory = join(root, "benchmark", "results");
mkdirSync(outputDirectory, { recursive: true });
const timestamp = environment.timestamp.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
const jsonPath = join(outputDirectory, `vize-checkers-${timestamp}.json`);
const markdownPath = join(outputDirectory, `vize-checkers-${timestamp}.md`);

const rows = results
  .map(
    (result) =>
      `| ${result.checkers} | ${(result.medianMs / 1000).toFixed(3)} s | ${(result.minMs / 1000).toFixed(3)}–${(result.maxMs / 1000).toFixed(3)} s | ${(baseline / result.medianMs).toFixed(2)}x |`,
  )
  .join("\n");

const markdown = `# Vize checker worker scaling benchmark

- Date: ${environment.timestamp}
- Machine: ${environment.cpu}, ${(environment.totalMemoryBytes / 1024 ** 3).toFixed(0)} GiB RAM, ${environment.logicalCpus} logical CPUs
- Runtime: ${environment.node}, ${environment.platform}
- Corpus: ${environment.componentCount.toLocaleString("en-US")} Vue SFCs, ${environment.intentionalErrorSites} intentional error sites
- Fixed Corsa servers: ${environment.vizeServers}
- Cache policy: ${environment.cachePolicy}
- Method: ${environment.warmups} warmup + ${environment.iterations} measured fresh-process runs per checker count; median shown

| Checker workers per Corsa process | Median | Range | Speedup vs ${checkerCounts[0]} checker |
| ---: | ---: | ---: | ---: |
${rows}
`;

writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(markdownPath, markdown);
console.log(`\n${markdown}`);
console.log(`Saved ${jsonPath}`);
console.log(`Saved ${markdownPath}`);
