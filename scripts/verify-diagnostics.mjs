import { spawnSync } from "node:child_process";
import { accessSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { commands, root } from "./commands.mjs";
import { assertExactDiagnostics, expectedDiagnostics } from "./diagnostics.mjs";

for (const command of commands) {
  accessSync(isAbsolute(command.executable) ? command.executable : join(root, command.executable));
  process.stdout.write(`Checking ${command.id}... `);
  const result = spawnSync(command.executable, command.args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout}\n${result.stderr}`;

  if (result.error) throw result.error;
  assertExactDiagnostics(command.id, output, result.status, result.signal);

  console.log(`ok (${expectedDiagnostics.length} exact diagnostics; no extras)`);
}
