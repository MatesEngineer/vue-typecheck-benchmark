<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import {
  firstTag,
  formatScore,
  getItemStatus,
  type BenchmarkItem,
  type ItemStatus,
} from "../shared";


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


</script>

<template>
  <article id="component-1560" @click="select">
    <h2>{{ item.label }}</h2>
    <output>{{ normalized }}</output>
    <small>{{ summary }}</small>
    <strong v-if="status.kind === 'ready'">{{ status.value.toFixed(1) }}</strong>
    <strong v-else>{{ status.reason }}</strong>
    <slot :value="normalized" :status="status" />

  </article>
</template>
