import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const componentCount = Number.parseInt(process.env.COMPONENT_COUNT ?? "5000", 10);
if (!Number.isSafeInteger(componentCount) || componentCount < 5000) {
  throw new Error("COMPONENT_COUNT must be an integer greater than or equal to 5000");
}

const root = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = join(root, "src", "generated");
if (!outputDirectory.endsWith("/src/generated")) {
  throw new Error(`Refusing to replace unexpected directory: ${outputDirectory}`);
}

rmSync(outputDirectory, { force: true, recursive: true });
mkdirSync(outputDirectory, { recursive: true });

const errorBodies = new Map([
  [777, "const brokenScore: number = props.item.label;"],
  [1555, "const brokenLabel = formatScore(props.item.label);"],
]);

const templateErrors = new Map([
  [2333, "<span>{{ item.unknownLabel }}</span>"],
  [3111, "<button @click=\"emit('select', item.label)\">Broken select</button>"],
  [3889, "<span>{{ normalized.toFixed(2) }}</span>"],
  [4667, "<span>{{ item.tags.notARealMethod() }}</span>"],
]);

for (let index = 0; index < componentCount; index += 1) {
  const suffix = index.toString().padStart(4, "0");
  const scriptError = errorBodies.get(index);
  const templateError = templateErrors.get(index);
  const source = `<script setup lang="ts">
import { computed } from "vue";
import { formatScore, type BenchmarkItem } from "../shared";

const props = defineProps<{
  item: BenchmarkItem;
  rank: number;
}>();

const emit = defineEmits<{
  select: [id: number];
  rename: [value: string];
}>();

const normalized = computed(() => formatScore(props.item.score * props.rank));
const select = () => emit("select", props.item.id);
${scriptError ? `${scriptError}\n` : ""}
</script>

<template>
  <article :data-component="'${suffix}'" @click="select">
    <h2>{{ item.label }}</h2>
    <output>{{ normalized }}</output>
    <small>{{ item.tags.join(", ") }}</small>
${templateError ? `    ${templateError}\n` : ""}
  </article>
</template>
`;

  writeFileSync(join(outputDirectory, `GeneratedComponent${suffix}.vue`), source);
}

console.log(`Generated ${componentCount.toLocaleString("en-US")} Vue SFCs in src/generated`);
