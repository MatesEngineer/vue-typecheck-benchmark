import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const componentCount = Number.parseInt(process.env.COMPONENT_COUNT ?? "2500", 10);
if (!Number.isSafeInteger(componentCount) || componentCount < 2500) {
  throw new Error("COMPONENT_COUNT must be an integer greater than or equal to 2500");
}

const root = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = join(root, "src", "generated");
if (!outputDirectory.endsWith("/src/generated")) {
  throw new Error(`Refusing to replace unexpected directory: ${outputDirectory}`);
}

rmSync(outputDirectory, { force: true, recursive: true });
mkdirSync(outputDirectory, { recursive: true });

const errorBodies = new Map([
  [222, 'emit("missing", props.item.id);'],
  [333, "const brokenScore: number = props.item.label;"],
  [444, 'emit("rename", props.item.id);'],
  [777, "const brokenLabel = formatScore(props.item.label);"],
  [1777, "const brokenRefArgument = computed(() => primaryChild.value?.focusRow(props.item.id));"],
  [1999, "const brokenRef = computed(() => primaryChild.value?.missingMethod());"],
]);

const templateErrors = new Map([
  [888, "<strong v-if=\"status.kind === 'blocked'\">{{ status.value }}</strong>"],
  [1111, "<span>{{ item.unknownLabel }}</span>"],
  [1333, "<ChildA :item=\"item\" :rank=\"rank\"><template #default=\"{ missing }\">{{ missing }}</template></ChildA>"],
  [1555, "<ChildA :item=\"item\" :rank=\"rank\" @select=\"(id: string) => id.length\" />"],
  [2111, "<ChildA :item=\"item\" />"],
  [2333, "<ChildA :item=\"item\" :rank=\"item.label\" />"],
]);

for (let index = 0; index < componentCount; index += 1) {
  const suffix = index.toString().padStart(4, "0");
  const clusterSize = 20;
  const clusterStart = Math.floor(index / clusterSize) * clusterSize;
  const clusterOffset = index - clusterStart;
  const childAIndex = clusterOffset > 0 ? index - 1 : null;
  const childBIndex = clusterOffset > 8 ? clusterStart + Math.floor(clusterOffset / 2) : null;
  const childAName = childAIndex === null ? null : `GeneratedComponent${childAIndex.toString().padStart(4, "0")}`;
  const childBName = childBIndex === null ? null : `GeneratedComponent${childBIndex.toString().padStart(4, "0")}`;
  const childImports = [childAName, childBName]
    .filter((name) => name !== null)
    .map((name, childIndex) => `import Child${childIndex === 0 ? "A" : "B"} from "./${name}.vue";`)
    .join("\n");
  const childScript = childAName
    ? `type ChildInstance = InstanceType<typeof ChildA>;
const primaryChild = useTemplateRef<ChildInstance>("primaryChild");
const childLabel = computed(() => primaryChild.value?.focusRow() ?? "");
const forwardSelect = (id: number) => emit("select", id);
`
    : "";
  const childTemplate = childAName
    ? `    <span v-if="childLabel">{{ childLabel }}</span>
    <ChildA
      ref="primaryChild"
      :item="item"
      :rank="rank + 1"
      @select="forwardSelect"
    >
      <template #default="{ value, status: childStatus }">
        <span>{{ value }}</span>
        <span v-if="childStatus.kind === 'blocked'">{{ childStatus.reason }}</span>
      </template>
    </ChildA>
${childBName ? `    <ChildB v-if="rank % 5 === 0" :item="item" :rank="rank + 2" @select="forwardSelect" />\n` : ""}`
    : "";
  const scriptError = errorBodies.get(index);
  const templateError = templateErrors.get(index);
  const source = `<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import {
  firstTag,
  formatScore,
  getItemStatus,
  type BenchmarkItem,
  type ItemStatus,
} from "../shared";
${childImports ? `${childImports}\n` : ""}

const props = defineProps<{
  item: BenchmarkItem;
  rank: number;
}>();

const emit = defineEmits<{
  select: [id: number];
  rename: [value: string];
}>();

defineSlots<{
  default(props: { value: string; status: ItemStatus }): unknown;
}>();

const normalized = computed(() => formatScore(props.item.score * props.rank));
const status = computed(() => getItemStatus(props.item));
const summary = computed(() => firstTag(props.item) + ":" + normalized.value);
const select = () => emit("select", props.item.id);
function focusRow(): string {
  return props.item.label;
}
defineExpose({ focusRow });
${childScript}
${scriptError ? `${scriptError}\n` : ""}
</script>

<template>
  <article id="component-${suffix}" @click="select">
    <h2>{{ item.label }}</h2>
    <output>{{ normalized }}</output>
    <small>{{ summary }}</small>
    <strong v-if="status.kind === 'ready'">{{ status.value.toFixed(1) }}</strong>
    <strong v-else>{{ status.reason }}</strong>
    <slot :value="normalized" :status="status" />
${childTemplate}${templateError ? `    ${templateError}\n` : ""}
  </article>
</template>
`;

  writeFileSync(join(outputDirectory, `GeneratedComponent${suffix}.vue`), source);
}

console.log(`Generated ${componentCount.toLocaleString("en-US")} Vue SFCs in src/generated`);
