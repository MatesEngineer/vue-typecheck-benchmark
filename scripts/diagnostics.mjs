export const expectedDiagnostics = [
  { file: "src/generated/GeneratedComponent0222.vue", line: 40, column: 6, code: 2769 },
  { file: "src/generated/GeneratedComponent0333.vue", line: 41, column: 7, code: 2322 },
  { file: "src/generated/GeneratedComponent0444.vue", line: 40, column: 6, code: 2769 },
  { file: "src/generated/GeneratedComponent0777.vue", line: 41, column: 33, code: 2345 },
  { file: "src/generated/GeneratedComponent0888.vue", line: 63, column: 56, code: 2339 },
  { file: "src/generated/GeneratedComponent1111.vue", line: 65, column: 19, code: 2339 },
  { file: "src/generated/GeneratedComponent1333.vue", line: 65, column: 61, code: 2339 },
  { file: "src/generated/GeneratedComponent1555.vue", line: 65, column: 40, code: 2322 },
  { file: "src/generated/GeneratedComponent1777.vue", line: 41, column: 71, code: 2554 },
  { file: "src/generated/GeneratedComponent1999.vue", line: 41, column: 54, code: 2339 },
  { file: "src/generated/GeneratedComponent2111.vue", line: 65, column: 6, code: 2345 },
  { file: "src/generated/GeneratedComponent2333.vue", line: 65, column: 27, code: 2322 },
];

const diagnosticPattern =
  /(?:^|\s)(src\/generated\/GeneratedComponent\d{4}\.vue)\((\d+),(\d+)\): error TS(\d+):/;

const key = ({ file, line, column, code }) => `${file}:${line}:${column}:TS${code}`;

export function expectedDiagnosticsFor(id) {
  if (id !== "vue-tsc") return expectedDiagnostics;
  return expectedDiagnostics.map((diagnostic) =>
    diagnostic.file.endsWith("GeneratedComponent0444.vue")
      ? { ...diagnostic, column: 1 }
      : diagnostic,
  );
}

export function parseDiagnostics(output) {
  const errorLines = output.split("\n").filter((line) => line.includes("error TS"));
  const diagnostics = [];
  const unparsed = [];

  for (const line of errorLines) {
    const match = line.match(diagnosticPattern);
    if (!match) {
      unparsed.push(line);
      continue;
    }
    diagnostics.push({
      file: match[1],
      line: Number.parseInt(match[2], 10),
      column: Number.parseInt(match[3], 10),
      code: Number.parseInt(match[4], 10),
    });
  }

  return { diagnostics, unparsed };
}

export function parseVizeDiagnostics(output) {
  const diagnostics = [];
  const unparsed = [];
  let currentFile = null;

  for (const line of output.split("\n")) {
    const fileMatch = line.match(/(src\/generated\/GeneratedComponent\d{4}\.vue)\r?$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      continue;
    }

    if (!line.includes("[TS")) continue;
    const diagnosticMatch = line.match(/^\s+error:(\d+):(\d+) \[TS(\d+)\]/);
    if (!currentFile || !diagnosticMatch) {
      unparsed.push(line);
      continue;
    }

    diagnostics.push({
      file: currentFile,
      line: Number.parseInt(diagnosticMatch[1], 10),
      column: Number.parseInt(diagnosticMatch[2], 10),
      code: Number.parseInt(diagnosticMatch[3], 10),
    });
  }

  return { diagnostics, unparsed };
}

export function compareDiagnostics(id, output) {
  const { diagnostics, unparsed } = parseDiagnostics(output);
  const expected = new Set(expectedDiagnosticsFor(id).map(key));
  const actual = new Set(diagnostics.map(key));
  return {
    actual: [...actual].sort(),
    expected: [...expected].sort(),
    missing: [...expected].filter((item) => !actual.has(item)).sort(),
    unexpected: [...actual].filter((item) => !expected.has(item)).sort(),
    unparsed,
  };
}

export function assertExactDiagnostics(id, output, status, signal = null) {
  if (signal || status === null) {
    throw new Error(
      `${id} terminated before producing diagnostics (status=${status}, signal=${signal})\n${output.slice(-4000)}`,
    );
  }
  if (status === 0) throw new Error(`${id} unexpectedly reported no diagnostics`);

  const comparison = compareDiagnostics(id, output);
  if (
    comparison.missing.length > 0 ||
    comparison.unexpected.length > 0 ||
    comparison.unparsed.length > 0
  ) {
    throw new Error(
      `${id} diagnostics did not exactly match the fixture:\n${JSON.stringify(comparison, null, 2)}`,
    );
  }

  return comparison.actual;
}

export function assertExactVizeDiagnostics(output, status, signal = null) {
  if (signal || status === null) {
    throw new Error(
      `vize check terminated before producing diagnostics (status=${status}, signal=${signal})\n${output.slice(-4000)}`,
    );
  }
  if (status === 0) throw new Error("vize check unexpectedly reported no diagnostics");

  const { diagnostics, unparsed } = parseVizeDiagnostics(output);
  const expected = new Set(expectedDiagnostics.map(key));
  const actual = new Set(diagnostics.map(key));
  const comparison = {
    actual: [...actual].sort(),
    expected: [...expected].sort(),
    missing: [...expected].filter((item) => !actual.has(item)).sort(),
    unexpected: [...actual].filter((item) => !expected.has(item)).sort(),
    unparsed,
  };

  if (
    comparison.missing.length > 0 ||
    comparison.unexpected.length > 0 ||
    comparison.unparsed.length > 0
  ) {
    throw new Error(
      `vize check diagnostics did not exactly match the fixture:\n${JSON.stringify(comparison, null, 2)}`,
    );
  }

  return comparison.actual;
}
