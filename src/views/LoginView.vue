<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { supabase } from '@/lib/supabase';
import Button from '@/components/Button.vue';

const router = useRouter();
const route = useRoute();

const isSignup = ref(false);
const email = ref('');
const password = ref('');
const submitting = ref(false);
const errorMessage = ref('');
const infoMessage = ref('');

function toggleMode() {
  isSignup.value = !isSignup.value;
  errorMessage.value = '';
  infoMessage.value = '';
}

async function onSubmit() {
  errorMessage.value = '';
  infoMessage.value = '';
  submitting.value = true;

  const { data, error } = isSignup.value
    ? await supabase.auth.signUp({ email: email.value, password: password.value })
    : await supabase.auth.signInWithPassword({ email: email.value, password: password.value });

  submitting.value = false;

  if (error) {
    errorMessage.value = error.message;
    return;
  }
  if (isSignup.value && !data.session) {
    infoMessage.value = 'Check your email to confirm your account, then sign in.';
    isSignup.value = false;
    return;
  }

  const redirect = (route.query.redirect as string) || '/dashboard';
  router.push(redirect);
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-bg text-ink px-6">
    <div class="w-full max-w-sm">
      <h1 class="text-3xl font-semibold mb-2">bridgemcp</h1>
      <p class="text-muted text-sm mb-8">
        {{ isSignup ? 'Create an account to start bridging your MCP servers.' : 'Sign in to manage your connections, tokens, and audit log.' }}
      </p>

      <p v-if="errorMessage" class="text-danger text-sm mb-4">{{ errorMessage }}</p>
      <p v-if="infoMessage" class="text-accent text-sm mb-4">{{ infoMessage }}</p>

      <form class="space-y-5" @submit.prevent="onSubmit">
        <div>
          <label for="email" class="block text-xs font-medium text-muted mb-1.5">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="w-full bg-transparent border-b border-rule focus:border-accent outline-none py-2 text-sm"
          />
        </div>
        <div>
          <label for="password" class="block text-xs font-medium text-muted mb-1.5">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="w-full bg-transparent border-b border-rule focus:border-accent outline-none py-2 text-sm"
          />
        </div>
        <Button type="submit" variant="primary" :disabled="submitting" class="w-full">
          {{ submitting ? (isSignup ? 'Creating…' : 'Signing in…') : isSignup ? 'Create account' : 'Sign in' }}
        </Button>
      </form>

      <p class="text-sm text-muted mt-6">
        {{ isSignup ? 'Already have an account?' : 'No account yet?' }}
        <button type="button" class="text-accent underline" @click="toggleMode">
          {{ isSignup ? 'Sign in' : 'Create one' }}
        </button>
      </p>
    </div>
  </div>
</template>
