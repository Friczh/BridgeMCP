<script setup lang="ts">
import { ref, onMounted } from 'vue';
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

// Set once a password sign-in succeeds but the account has a verified TOTP
// factor and the session hasn't been elevated to aal2 yet. Per design.md:
// "after password, check getAuthenticatorAssuranceLevel() — if a TOTP factor
// exists and AAL is aal1, prompt for code, then mfa.challenge() + mfa.verify()."
const mfaRequired = ref(false);
const mfaFactorId = ref('');
const mfaCode = ref('');

function toggleMode() {
  isSignup.value = !isSignup.value;
  errorMessage.value = '';
  infoMessage.value = '';
}

function finishLogin() {
  const redirect = (route.query.redirect as string) || '/dashboard';
  router.push(redirect);
}

// If the router guard bounced here because a persisted aal1 session exists
// but 2FA hasn't been completed yet (e.g. a page refresh mid-challenge —
// see router/index.ts), jump straight to the code step instead of forcing
// the password to be retyped. The password step already succeeded; it's
// only the code that's still outstanding.
onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || aal.currentLevel === aal.nextLevel) return;

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) return;
  const totpFactor = factors.totp.find((f) => f.status === 'verified');
  if (!totpFactor) return;

  mfaFactorId.value = totpFactor.id;
  mfaRequired.value = true;
});

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

  if (isSignup.value) {
    finishLogin();
    return;
  }

  // Password step succeeded — check whether a verified TOTP factor still
  // needs to be challenged before the session is fully authenticated.
  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) {
    errorMessage.value = aalError.message;
    return;
  }
  if (aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      errorMessage.value = factorsError.message;
      return;
    }
    const totpFactor = factors.totp.find((f) => f.status === 'verified');
    if (!totpFactor) {
      errorMessage.value = 'This account requires two-factor authentication but no verified factor was found.';
      return;
    }
    mfaFactorId.value = totpFactor.id;
    mfaRequired.value = true;
    return;
  }

  finishLogin();
}

async function onMfaSubmit() {
  errorMessage.value = '';
  submitting.value = true;

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: mfaFactorId.value,
  });
  if (challengeError) {
    submitting.value = false;
    errorMessage.value = challengeError.message;
    return;
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: mfaFactorId.value,
    challengeId: challenge.id,
    code: mfaCode.value,
  });

  submitting.value = false;

  if (verifyError) {
    errorMessage.value = verifyError.message;
    mfaCode.value = '';
    return;
  }

  finishLogin();
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-bg text-ink px-6">
    <div class="w-full max-w-sm">
      <h1 class="text-3xl font-semibold mb-2">bridgemcp</h1>

      <template v-if="mfaRequired">
        <p class="text-muted text-sm mb-8">Enter the 6-digit code from your authenticator app.</p>
        <p v-if="errorMessage" class="text-danger text-sm mb-4">{{ errorMessage }}</p>
        <form class="space-y-5" @submit.prevent="onMfaSubmit">
          <div>
            <label for="mfa-code" class="block text-xs font-medium text-muted mb-1.5">Authentication code</label>
            <input
              id="mfa-code"
              v-model="mfaCode"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              required
              class="w-full bg-transparent border-b border-rule focus:border-accent outline-none py-2 text-sm mono tracking-widest"
            />
          </div>
          <Button type="submit" variant="primary" :disabled="submitting" class="w-full">
            {{ submitting ? 'Verifying…' : 'Verify' }}
          </Button>
        </form>
      </template>

      <template v-else>
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
      </template>
    </div>
  </div>
</template>