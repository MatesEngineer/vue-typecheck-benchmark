import { execFile, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { cpus, hostname, platform, release, tmpdir, totalmem } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { commands, root } from "./commands.mjs";
import {
  assertExactDiagnostics,
  assertExactVizeDiagnostics,
  expectedDiagnostics,
} from "./diagnostics.mjs";

const execFileAsync = promisify(execFile);

const readNumberArgument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? fallback : Number.parseInt(process.argv[index + 1] ?? "", 10);
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${name} must be a positive integer`);
  return value;
};

const readCheckerCounts = () => {
  const index = process.argv.indexOf("--vize-checkers");
  const input = index === -1 ? "1,2,4,8" : (process.argv[index + 1] ?? "");
  if (input === "none") return [];
  const values = input.split(",").map((value) => Number.parseInt(value, 10));
  if (values.length === 0 || values.some((value) => !Number.isSafeInteger(value) || value < 1)) {
    throw new Error("--vize-checkers must be a comma-separated list of positive integers or none");
  }
  return [...new Set(values)];
};

const iterations = readNumberArgument("--runs", 3);
const intervalMs = readNumberArgument("--interval", 100);
const checkerCounts = readCheckerCounts();
if (iterations < 1) throw new Error("--runs must be at least 1");
if (intervalMs < 10) throw new Error("--interval must be at least 10 ms");
if (process.platform === "win32") throw new Error("benchmark-memory.mjs samples RSS with ps");

const binSuffix = process.platform === "win32" ? ".cmd" : "";
const vizeCheckTargets = checkerCounts.map((checkers) => ({
  id: `vize-check-${checkers}`,
  label: `vize check (${checkers} checker${checkers === 1 ? "" : "s"}, 1 Corsa server)`,
  executable: `node_modules/.bin/vize${binSuffix}`,
  args: [
    "check",
    "--tsconfig",
    "tsconfig.base.json",
    "--format",
    "text",
    "--servers",
    "1",
    "--checkers",
    String(checkers),
  ],
  vizeCheck: true,
}));
const targets = [...commands, ...vizeCheckTargets];

/** Sum the RSS of a process and all of its descendants from one `ps` snapshot. */
async function sampleTree(rootPid) {
  const { stdout } = await execFileAsync("ps", ["-A", "-o", "pid=,ppid=,rss="], {
    maxBuffer: 16 * 1024 * 1024,
  });
  const children = new Map();
  const rss = new Map();
  for (const line of stdout.split("\n")) {
    const [pid, ppid, kib] = line.trim().split(/\s+/).map(Number);
    if (!Number.isSafeInteger(pid)) continue;
    rss.set(pid, kib * 1024);
    if (!children.has(ppid)) children.set(ppid, []);
    children.get(ppid).push(pid);
  }
  let total = 0;
  let largest = 0;
  let count = 0;
  const queue = [rootPid];
  while (queue.length > 0) {
    const pid = queue.pop();
    const bytes = rss.get(pid);
    if (bytes === undefined) continue;
    total += bytes;
    largest = Math.max(largest, bytes);
    count += 1;
    queue.push(...(children.get(pid) ?? []));
  }
  return { total, largest, count };
}

async function run(target) {
  const home = target.vizeCheck ? mkdtempSync(join(tmpdir(), "vize-memory-home-")) : undefined;
  const child = spawn(target.executable, target.args, {
    cwd: root,
    env: home ? { ...process.env, HOME: home, XDG_CACHE_HOME: join(home, ".cache") } : process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => (output += chunk));
  child.stderr.setEncoding("utf8").on("data", (chunk) => (output += chunk));

  let peakTotal = 0;
  let peakLargest = 0;
  let peakProcesses = 0;
  let samples = 0;
  let exited = false;
  const exit = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (status, signal) => {
      exited = true;
      resolve({ status, signal });
    });
  });
  const sampler = (async () => {
    while (!exited) {
      const snapshot = await sampleTree(child.pid);
      if (snapshot.count > 0) {
        samples += 1;
        peakTotal = Math.max(peakTotal, snapshot.total);
        peakLargest = Math.max(peakLargest, snapshot.largest);
        peakProcesses = Math.max(peakProcesses, snapshot.count);
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  })();

  const { status, signal } = await exit;
  await sampler;
  if (home) rmSync(home, { recursive: true, force: true });
  if (target.vizeCheck) assertExactVizeDiagnostics(output, status, signal);
  else assertExactDiagnostics(target.id, output, status, signal);
  return { peakTotal, peakLargest, peakProcesses, samples };
}

const samples = Object.fromEntries(targets.map((target) => [target.id, []]));
for (let iteration = 0; iteration < iterations; iteration += 1) {
  const offset = iteration % targets.length;
  const rotated = targets.slice(offset).concat(targets.slice(0, offset));
  for (const target of rotated) {
    process.stdout.write(`Run ${iteration + 1}/${iterations}: ${target.id}... `);
    const sample = await run(target);
    samples[target.id].push(sample);
    console.log(
      `${(sample.peakTotal / 1024 ** 3).toFixed(2)} GiB tree, ${(sample.peakLargest / 1024 ** 3).toFixed(2)} GiB largest process`,
    );
  }
}

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) * 0.5)];
};

const results = targets.map((target) => {
  const values = samples[target.id];
  const totals = values.map((value) => value.peakTotal);
  return {
    id: target.id,
    label: target.label,
    samples: values,
    medianPeakTreeRssBytes: median(totals),
    minPeakTreeRssBytes: Math.min(...totals),
    maxPeakTreeRssBytes: Math.max(...totals),
    medianPeakLargestProcessRssBytes: median(values.map((value) => value.peakLargest)),
    maxProcesses: Math.max(...values.map((value) => value.peakProcesses)),
  };
});

const environment = {
  timestamp: new Date().toISOString(),
  hostname: hostname(),
  platform: `${platform()} ${release()}`,
  cpu: cpus()[0]?.model ?? "unknown",
  logicalCpus: cpus().length,
  totalMemoryBytes: totalmem(),
  node: process.version,
  intentionalErrorSites: expectedDiagnostics.length,
  metric:
    "peak resident set size of the spawned process tree (checker, Content Mapper, and wrappers), sampled with ps; shared pages are counted once per process",
  samplingIntervalMs: intervalMs,
  cachePolicy:
    "fresh process; no compiler, mapper, task, or tsbuildinfo cache; vize check also uses a fresh HOME per run",
  iterations,
};

const gib = (bytes) => `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
const baseline = results.find((result) => result.id === "vue-tsc").medianPeakTreeRssBytes;
const rows = results
  .sort((left, right) => left.medianPeakTreeRssBytes - right.medianPeakTreeRssBytes)
  .map(
    (result) =>
      `| ${result.label} | ${gib(result.medianPeakTreeRssBytes)} | ${gib(result.minPeakTreeRssBytes)}–${gib(result.maxPeakTreeRssBytes)} | ${gib(result.medianPeakLargestProcessRssBytes)} | ${result.maxProcesses} | ${(result.medianPeakTreeRssBytes / baseline).toFixed(2)}x |`,
  )
  .join("\n");

const markdown = `# Vue typecheck memory benchmark

- Date: ${environment.timestamp}
- Machine: ${environment.cpu}, ${(environment.totalMemoryBytes / 1024 ** 3).toFixed(0)} GiB RAM
- Runtime: ${environment.node}, ${environment.platform}
- Metric: ${environment.metric}
- Sampling interval: ${environment.samplingIntervalMs} ms
- Cache policy: ${environment.cachePolicy}
- Method: ${environment.iterations} measured process runs per command; median shown

| Checker | Peak tree RSS | Range | Largest process | Processes | vs vue-tsc |
| --- | ---: | ---: | ---: | ---: | ---: |
${rows}
`;

const outputDirectory = join(root, "benchmark", "results");
mkdirSync(outputDirectory, { recursive: true });
const timestamp = environment.timestamp.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
const jsonPath = join(outputDirectory, `memory-${timestamp}.json`);
const markdownPath = join(outputDirectory, `memory-${timestamp}.md`);
writeFileSync(jsonPath, `${JSON.stringify({ environment, results }, null, 2)}\n`);
writeFileSync(markdownPath, markdown);
console.log(`\n${markdown}`);
console.log(`Saved ${jsonPath}`);
console.log(`Saved ${markdownPath}`);
