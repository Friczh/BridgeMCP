<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger';
    type?: 'button' | 'submit';
    disabled?: boolean;
  }>(),
  { variant: 'primary', type: 'button', disabled: false },
);
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="px-5 py-2.5 rounded-pill text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    :class="{
      'bg-accent text-accent-ink hover:opacity-90': variant === 'primary',
      'bg-transparent border border-rule text-ink hover:border-accent': variant === 'secondary',
      'bg-transparent border border-rule text-danger hover:border-danger': variant === 'danger',
    }"
  >
    <slot />
  </button>
</template>
