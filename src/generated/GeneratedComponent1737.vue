<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import {
  firstTag,
  formatScore,
  getItemStatus,
  type BenchmarkItem,
  type ItemStatus,
} from "../shared";
import ChildA from "./GeneratedComponent1736.vue";
import ChildB from "./GeneratedComponent1728.vue";


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
type ChildInstance = InstanceType<typeof ChildA>;
const primaryChild = useTemplateRef<ChildInstance>("primaryChild");
const childLabel = computed(() => primaryChild.value?.focusRow() ?? "");
const forwardSelect = (id: number) => emit("select", id);


</script>

<template>
  <article id="component-1737" @click="select">
    <h2>{{ item.label }}</h2>
    <output>{{ normalized }}</output>
    <small>{{ summary }}</small>
    <strong v-if="status.kind === 'ready'">{{ status.value.toFixed(1) }}</strong>
    <strong v-else>{{ status.reason }}</strong>
    <slot :value="normalized" :status="status" />
    <span v-if="childLabel">{{ childLabel }}</span>
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
    <ChildB v-if="rank % 5 === 0" :item="item" :rank="rank + 2" @select="forwardSelect" />

  </article>
</template>
