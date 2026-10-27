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
const brokenScore: number = props.item.label;

</script>

<template>
  <article :data-component="'0777'" @click="select">
    <h2>{{ item.label }}</h2>
    <output>{{ normalized }}</output>
    <small>{{ item.tags.join(", ") }}</small>

  </article>
</template>
