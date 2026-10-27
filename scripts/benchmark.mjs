import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { cpus, freemem, hostname, platform, release, totalmem } from "node:os";
import { join } from "node:path";
import { commands, root } from "./commands.mjs";
import { assertExactDiagnostics, expectedDiagnostics } from "./diagnostics.mjs";

const readNumberArgument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? fallback : Number.parseInt(process.argv[index + 1] ?? "", 10);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a positive integer`);
  return value;
};

const iterations = readNumberArgument("--runs", 5);
const warmups = readNumberArgument("--warmup", 0);
if (iterations < 1) throw new Error("--runs must be at least 1");

function run(command) {
  const start = process.hrtime.bigint();
  const result = spawnSync(command.executable, command.args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
  if (result.error) throw result.error;
  assertExactDiagnostics(command.id, `${result.stdout}\n${result.stderr}`, result.status, result.signal);
  return durationMs;
}

for (let warmup = 0; warmup < warmups; warmup += 1) {
  for (const command of commands) {
    process.stdout.write(`Warmup ${warmup + 1}/${warmups}: ${command.id}\r`);
    run(command);
  }
}
process.stdout.write(" ".repeat(80) + "\r");

const samples = Object.fromEntries(commands.map((command) => [command.id, []]));
for (let iteration = 0; iteration < iterations; iteration += 1) {
  const rotated = commands.slice(iteration % commands.length).concat(commands.slice(0, iteration % commands.length));
  for (const command of rotated) {
    process.stdout.write(`Run ${iteration + 1}/${iterations}: ${command.id}... `);
    const durationMs = run(command);
    samples[command.id].push(durationMs);
    console.log(`${(durationMs / 1000).toFixed(3)} s`);
  }
}

const percentile = (values, ratio) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) * ratio)];
};

const results = commands.map((command) => {
  const values = samples[command.id];
  const meanMs = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - meanMs) ** 2, 0) / values.length;
  return {
    id: command.id,
    label: command.label,
    samplesMs: values,
    meanMs,
    medianMs: percentile(values, 0.5),
    minMs: Math.min(...values),
    maxMs: Math.max(...values),
    standardDeviationMs: Math.sqrt(variance),
  };
});

const baseline = results.find((result) => result.id === "vue-tsc").medianMs;
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
  cachePolicy: "fresh process; no compiler, mapper, task, or tsbuildinfo cache; OS page cache not flushed",
  warmups,
  iterations,
};

const report = { environment, results };
const outputDirectory = join(root, "benchmark", "results");
mkdirSync(outputDirectory, { recursive: true });
const timestamp = environment.timestamp.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
const jsonPath = join(outputDirectory, `${timestamp}.json`);
const markdownPath = join(outputDirectory, `${timestamp}.md`);

const rows = results
  .sort((left, right) => left.medianMs - right.medianMs)
  .map(
    (result) =>
      `| ${result.label} | ${(result.medianMs / 1000).toFixed(3)} s | ${(result.minMs / 1000).toFixed(3)}–${(result.maxMs / 1000).toFixed(3)} s | ${(baseline / result.medianMs).toFixed(2)}x |`,
  )
  .join("\n");

const markdown = `# Vue typecheck benchmark

- Date: ${environment.timestamp}
- Machine: ${environment.cpu}, ${(environment.totalMemoryBytes / 1024 ** 3).toFixed(0)} GiB RAM
- Runtime: ${environment.node}, ${environment.platform}
- Corpus: ${environment.componentCount.toLocaleString("en-US")} Vue SFCs, ${environment.intentionalErrorSites} intentional error sites
- Cache policy: ${environment.cachePolicy}
- Method: ${environment.warmups} warmup + ${environment.iterations} measured process runs per command; median shown

| Checker | Median | Range | Speedup vs vue-tsc |
| --- | ---: | ---: | ---: |
${rows}
`;

writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(markdownPath, markdown);
console.log(`\n${markdown}`);
console.log(`Saved ${jsonPath}`);
console.log(`Saved ${markdownPath}`);
