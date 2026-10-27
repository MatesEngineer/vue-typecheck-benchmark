import { spawnSync } from "node:child_process";
import { accessSync } from "node:fs";
import { join } from "node:path";
import { commands, root } from "./commands.mjs";

const expectedFiles = [
  "GeneratedComponent0777.vue",
  "GeneratedComponent1555.vue",
  "GeneratedComponent2333.vue",
  "GeneratedComponent3111.vue",
  "GeneratedComponent3889.vue",
  "GeneratedComponent4667.vue",
];

for (const command of commands) {
  accessSync(join(root, command.executable));
  process.stdout.write(`Checking ${command.id}... `);
  const result = spawnSync(command.executable, command.args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout}\n${result.stderr}`;
  const missing = expectedFiles.filter((file) => !output.includes(file));

  if (result.error) throw result.error;
  if (result.status === 0) {
    throw new Error(`${command.id} unexpectedly reported no diagnostics`);
  }
  if (missing.length > 0) {
    throw new Error(`${command.id} did not report expected files: ${missing.join(", ")}\n${output}`);
  }

  console.log(`ok (${expectedFiles.length} intentional error sites)`);
}
