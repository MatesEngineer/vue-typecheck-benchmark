import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));

const binSuffix = process.platform === "win32" ? ".cmd" : "";

export const commands = [
  {
    id: "vue-tsc",
    label: "vue-tsc 3.3.13 + TypeScript 6.0.3",
    executable: process.execPath,
    args: [
      "--max-old-space-size=4096",
      "tools/vue-tsc/node_modules/vue-tsc/bin/vue-tsc.js",
      "--noEmit",
      "--pretty",
      "false",
      "-p",
      "tsconfig.vue-tsc.json",
    ],
  },
  {
    id: "vue-tsgo",
    label: "@vue/content-mapper 4.0.0-alpha.0 + TypeScript 7.1 beta (tsc)",
    executable: `node_modules/.bin/tsc${binSuffix}`,
    args: [
      "--runExternalCode",
      "--noEmit",
      "--pretty",
      "false",
      "-p",
      "tsconfig.vue-content-mapper.json",
    ],
  },
  {
    id: "vue-tsrs",
    label: "@vue/content-mapper 4.0.0-alpha.0 + tsrs 0.21.0",
    executable: `node_modules/.bin/tsrs${binSuffix}`,
    args: [
      "--runExternalCode",
      "--noEmit",
      "--pretty",
      "false",
      "-p",
      "tsconfig.vue-content-mapper.json",
    ],
  },
  {
    id: "vize-tsgo",
    label: "Vize 0.679.0 Content Mapper + TypeScript 7.1 beta (tsc)",
    executable: `node_modules/.bin/tsc${binSuffix}`,
    args: [
      "--runExternalCode",
      "--noEmit",
      "--pretty",
      "false",
      "-p",
      "tsconfig.vize-content-mapper.json",
    ],
  },
  {
    id: "vize-tsrs",
    label: "Vize 0.679.0 Content Mapper + tsrs 0.21.0",
    executable: `node_modules/.bin/tsrs${binSuffix}`,
    args: [
      "--runExternalCode",
      "--noEmit",
      "--pretty",
      "false",
      "-p",
      "tsconfig.vize-content-mapper.json",
    ],
  },
  {
    id: "vue-tsrs-fast",
    label: "@vue/content-mapper 4.0.0-alpha.0 + tsrs 0.21.0 --fast",
    executable: `node_modules/.bin/tsrs${binSuffix}`,
    args: [
      "--fast",
      "--runExternalCode",
      "--noEmit",
      "--pretty",
      "false",
      "-p",
      "tsconfig.vue-content-mapper.json",
    ],
  },
  {
    id: "vize-tsrs-fast",
    label: "Vize 0.679.0 Content Mapper + tsrs 0.21.0 --fast",
    executable: `node_modules/.bin/tsrs${binSuffix}`,
    args: [
      "--fast",
      "--runExternalCode",
      "--noEmit",
      "--pretty",
      "false",
      "-p",
      "tsconfig.vize-content-mapper.json",
    ],
  },
];
