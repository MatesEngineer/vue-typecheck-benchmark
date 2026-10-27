<script setup lang="ts">
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

</script>

<template>
  <article :data-component="'2333'" @click="select">
    <h2>{{ item.label }}</h2>
    <output>{{ normalized }}</output>
    <small>{{ item.tags.join(", ") }}</small>
    <span>{{ item.unknownLabel }}</span>

  </article>
</template>
