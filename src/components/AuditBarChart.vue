<script setup lang="ts">
import { computed } from 'vue';
import type { AuditDailyStat } from '@/types';

const props = defineProps<{ data: AuditDailyStat[] }>();

const WIDTH = 720;
const HEIGHT = 200;
const PAD_BOTTOM = 24;
const PAD_TOP = 12;
const BAR_GAP = 8;

const maxTotal = computed(() => Math.max(1, ...props.data.map((d) => d.ok_count + d.error_count)));

const barWidth = computed(() => {
  const n = props.data.length || 1;
  return (WIDTH - BAR_GAP * (n - 1)) / n;
});

const chartHeight = HEIGHT - PAD_BOTTOM - PAD_TOP;

function okHeight(d: AuditDailyStat): number {
  return (d.ok_count / maxTotal.value) * chartHeight;
}
function errorHeight(d: AuditDailyStat): number {
  return (d.error_count / maxTotal.value) * chartHeight;
}
function barX(i: number): number {
  return i * (barWidth.value + BAR_GAP);
}
function shortLabel(date: string): string {
  return date.slice(5); // "MM-DD"
}
</script>

<template>
  <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" class="w-full h-auto" preserveAspectRatio="none">
    <!-- baseline — the only structural line, per the theme's exposed-hairline discipline -->
    <line
      :x1="0"
      :y1="HEIGHT - PAD_BOTTOM"
      :x2="WIDTH"
      :y2="HEIGHT - PAD_BOTTOM"
      stroke="var(--rule)"
      stroke-width="1"
    />

    <g v-for="(d, i) in data" :key="d.date">
      <!-- error segment stacked on top of ok segment -->
      <rect
        v-if="d.error_count > 0"
        :x="barX(i)"
        :y="HEIGHT - PAD_BOTTOM - okHeight(d) - errorHeight(d)"
        :width="barWidth"
        :height="errorHeight(d)"
        fill="var(--ink)"
        opacity="0.35"
      />
      <rect
        v-if="d.ok_count > 0"
        :x="barX(i)"
        :y="HEIGHT - PAD_BOTTOM - okHeight(d)"
        :width="barWidth"
        :height="Math.max(okHeight(d), 0)"
        fill="var(--accent)"
      />
      <rect
        v-if="d.ok_count === 0 && d.error_count === 0"
        :x="barX(i)"
        :y="HEIGHT - PAD_BOTTOM - 2"
        :width="barWidth"
        height="2"
        fill="var(--rule)"
      />
      <text
        :x="barX(i) + barWidth / 2"
        :y="HEIGHT - 6"
        text-anchor="middle"
        font-size="10"
        letter-spacing="0.05em"
        fill="var(--muted)"
        style="font-family: 'Archivo', sans-serif; text-transform: uppercase"
      >
        {{ shortLabel(d.date) }}
      </text>
    </g>
  </svg>
</template>
