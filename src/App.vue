<script setup lang="ts">
import GeneratedComponent0000 from "./generated/GeneratedComponent0000.vue";

const item = {
  id: 1,
  label: "Typecheck benchmark",
  score: 100,
  tags: ["vue", "typescript"],
} as const;
</script>

<template>
  <main>
    <GeneratedComponent0000 :item="item" :rank="1" />
  </main>
</template>
