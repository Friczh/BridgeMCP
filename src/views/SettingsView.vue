<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Copy, Check } from 'lucide-vue-next';
import Pane from '@/components/Pane.vue';
import Button from '@/components/Button.vue';
import Popup from '@/components/Popup.vue';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/composables/useAuth';
import { useSystemPopup } from '@/composables/useSystemPopup';
import { apiFetch } from '@/api/client';
import { CONFIG } from '@/config';

const { session } = useAuth();
const { showConfirm } = useSystemPopup();

// ---- Re-authentication gate (server-enforced) ----
// Required before any sensitive settings action (password change, 2FA disable).
// Both steps are verified by the Worker, not just the browser — a stolen/replayed
// session token alone can't complete this, since the Worker independently re-checks
// the password against Supabase Auth and, for step 2, a fresh TOTP code. Success
// yields a short-lived (2 min) reauth token that the actual mutation call must send
// back as `X-Reauth-Token`. See design.md "Server-side re-authentication".
const reauthOpen = ref(false);
const reauthStep = ref<'password' | 'code'>('password');
const reauthPassword = ref('');
const reauthCode = ref('');
const reauthPartialToken = ref('');
const reauthError = ref('');
const reauthSubmitting = ref(false);
let pendingAction: ((reauthToken: string) => void | Promise<void>) | null = null;

function requireReauth(action: (reauthToken: string) => void | Promise<void>) {
  pendingAction = action;
  reauthStep.value = 'password';
  reauthPassword.value = '';
  reauthCode.value = '';
  reauthPartialToken.value = '';
  reauthError.value = '';
  reauthOpen.value = true;
}

async function submitReauthPassword() {
  reauthError.value = '';
  reauthSubmitting.value = true;
  try {
    const res = await apiFetch<{ status: string; reauth_token?: string; partial_token?: string }>(
      '/manage/account/reauth/password',
      { method: 'POST', body: JSON.stringify({ password: reauthPassword.value }) },
      { silentUnauthorized: true }
    );
    if (res?.status === 'mfa_required' && res.partial_token) {
      reauthPartialToken.value = res.partial_token;
      reauthStep.value = 'code';
      return;
    }
    if (res?.reauth_token) await completeReauth(res.reauth_token);
  } catch {
    reauthError.value = 'Incorrect password.';
  } finally {
    reauthSubmitting.value = false;
  }
}

async function submitReauthCode() {
  reauthError.value = '';
  reauthSubmitting.value = true;
  try {
    const res = await apiFetch<{ status: string; reauth_token: string }>(
      '/manage/account/reauth/mfa',
      { method: 'POST', body: JSON.stringify({ partial_token: reauthPartialToken.value, code: reauthCode.value }) },
      { silentUnauthorized: true }
    );
    if (res?.reauth_token) await completeReauth(res.reauth_token);
  } catch {
    reauthError.value = 'Invalid code.';
  } finally {
    reauthSubmitting.value = false;
  }
}

async function completeReauth(reauthToken: string) {
  const action = pendingAction;
  pendingAction = null;
  reauthOpen.value = false;
  if (action) await action(reauthToken);
}

// ---- Password ----
// Mutation goes through the Worker (POST /manage/account/password, requires
// X-Reauth-Token) — not supabase.auth.updateUser directly — so it's actually
// gated by the reauth check above, not just the UI trigger for it.
// Fields live behind a popup opened only after requireReauth() succeeds; the
// Pane itself only ever shows a button, never the form.
const passwordFormOpen = ref(false);
const activeReauthToken = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const passwordSubmitting = ref(false);
const passwordError = ref('');
const passwordSuccess = ref('');

function openPasswordForm(reauthToken: string) {
  activeReauthToken.value = reauthToken;
  newPassword.value = '';
  confirmPassword.value = '';
  passwordError.value = '';
  passwordFormOpen.value = true;
}

async function onChangePassword() {
  passwordError.value = '';

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Passwords do not match.';
    return;
  }
  if (newPassword.value.length < 8) {
    passwordError.value = 'Password must be at least 8 characters.';
    return;
  }

  passwordSubmitting.value = true;
  try {
    await apiFetch('/manage/account/password', {
      method: 'POST',
      headers: { 'X-Reauth-Token': activeReauthToken.value },
      body: JSON.stringify({ password: newPassword.value }),
    });
  } catch {
    passwordSubmitting.value = false;
    passwordError.value = 'Could not update password. Try again.';
    return;
  }
  passwordSubmitting.value = false;
  passwordFormOpen.value = false;
  passwordSuccess.value = 'Password updated.';
  newPassword.value = '';
  confirmPassword.value = '';
}

// ---- 2FA (TOTP only) ----
// Client-side via Supabase Auth MFA — no Worker route (per design.md).
type EnrollState =
  | { step: 'idle' }
  | { step: 'enrolling'; factorId: string; qrCode: string; secret: string };

const factorId = ref<string | null>(null); // id of the currently verified factor, if any
const factorsLoading = ref(true);
const enroll = ref<EnrollState>({ step: 'idle' });
const enrollCode = ref('');
const enrollError = ref('');
const enrollSubmitting = ref(false);
const secretCopied = ref(false);

async function copySecret(secret: string) {
  await navigator.clipboard.writeText(secret);
  secretCopied.value = true;
}

async function loadFactors() {
  factorsLoading.value = true;
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    const verified = data.totp.find((f) => f.status === 'verified');
    factorId.value = verified?.id ?? null;
  } finally {
    factorsLoading.value = false;
  }
}
onMounted(loadFactors);

async function startEnrollInner() {
  enrollError.value = '';
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error) {
    enrollError.value = error.message;
    return;
  }
  enroll.value = {
    step: 'enrolling',
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
  enrollCode.value = '';
  secretCopied.value = false;
}
function startEnroll() {
  // Enrollment itself must stay a direct Supabase Auth call (it needs a live
  // user session to mint/display the QR+secret) — the Worker has no route
  // for it. This reauth gate only protects the "start enroll" trigger in the
  // UI; see design.md for why enroll can't be moved fully server-side.
  requireReauth(startEnrollInner);
}

function cancelEnroll() {
  // Unverified factor is left as-is — Supabase auto-expires unverified
  // factors, and a stray unverified row doesn't grant sign-in access.
  enroll.value = { step: 'idle' };
  enrollCode.value = '';
  enrollError.value = '';
}

async function confirmEnroll() {
  if (enroll.value.step !== 'enrolling') return;
  enrollError.value = '';
  enrollSubmitting.value = true;

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: enroll.value.factorId,
  });
  if (challengeError) {
    enrollSubmitting.value = false;
    enrollError.value = challengeError.message;
    return;
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: enroll.value.factorId,
    challengeId: challenge.id,
    code: enrollCode.value,
  });
  enrollSubmitting.value = false;

  if (verifyError) {
    enrollError.value = verifyError.message;
    return;
  }

  enroll.value = { step: 'idle' };
  await loadFactors();
}

function onDisable2fa() {
  requireReauth((reauthToken) => {
    showConfirm({
      title: 'Disable two-factor authentication',
      message: 'This removes your authenticator app as a sign-in requirement. Continue?',
      confirmLabel: 'Disable',
      onConfirm: async () => {
        await apiFetch('/manage/account/mfa/disable', {
          method: 'POST',
          headers: { 'X-Reauth-Token': reauthToken },
        });
        await loadFactors();
      },
    });
  });
}
</script>

<template>
  <div>
    <h2 class="text-2xl font-semibold mb-1">Settings</h2>
    <p class="text-muted text-sm mb-8">Account and bridge configuration.</p>

    <Pane title="account">
      <div class="ruled-row" style="--cols: 1fr 2fr">
        <div class="text-muted text-xs">Account</div>
        <div class="text-sm">{{ session?.user.email }}</div>
      </div>
      <div class="ruled-row" style="--cols: 1fr 2fr">
        <div class="text-muted text-xs">Bridge URL</div>
        <div class="mono text-xs break-all">{{ CONFIG.WORKER_URL }}</div>
      </div>
    </Pane>

    <div class="h-6"></div>

    <Pane title="password">
      <p v-if="passwordSuccess" class="text-accent text-sm mb-4">{{ passwordSuccess }}</p>
      <Button variant="primary" @click="requireReauth(openPasswordForm)">Update password</Button>
    </Pane>

    <div class="h-6"></div>

    <Pane title="two-factor authentication">
      <p v-if="factorsLoading" class="text-muted text-sm py-2">Loading…</p>

      <template v-else>
        <p v-if="enrollError" class="text-danger text-sm mb-4">{{ enrollError }}</p>

        <template v-if="enroll.step === 'enrolling'">
          <p class="text-muted text-sm mb-4">
            Scan this QR code with your authenticator app, or enter the key manually if you're setting this up
            on the same device — enter the code it generates below either way.
          </p>
          <img :src="enroll.qrCode" alt="TOTP QR code" class="w-40 h-40 mb-4 bg-white p-2 rounded-pane" />
          <div class="mb-6">
            <div class="text-xs font-medium text-muted mb-1.5">Manual entry key</div>
            <div class="flex items-center gap-2">
              <span class="mono text-xs break-all">{{ enroll.secret }}</span>
              <button
                type="button"
                class="text-muted hover:text-accent shrink-0"
                :title="secretCopied ? 'Copied' : 'Copy key'"
                @click="copySecret(enroll.secret)"
              >
                <Check v-if="secretCopied" class="icon w-4 h-4" />
                <Copy v-else class="icon w-4 h-4" />
              </button>
            </div>
          </div>
          <form class="space-y-5 max-w-sm" @submit.prevent="confirmEnroll">
            <div>
              <label for="enroll-code" class="block text-xs font-medium text-muted mb-1.5">Authentication code</label>
              <input
                id="enroll-code"
                v-model="enrollCode"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
                required
                class="w-full bg-transparent border-b border-rule focus:border-accent outline-none py-2 text-sm mono tracking-widest"
              />
            </div>
            <div class="flex gap-3">
              <Button type="submit" variant="primary" :disabled="enrollSubmitting">
                {{ enrollSubmitting ? 'Verifying…' : 'Confirm' }}
              </Button>
              <Button type="button" variant="secondary" @click="cancelEnroll">Cancel</Button>
            </div>
          </form>
        </template>

        <template v-else-if="factorId">
          <div class="flex items-center justify-between gap-4">
            <p class="text-sm">
              <span class="mono text-xs px-2 py-1 rounded-pane border border-accent text-accent">enabled</span>
              <span class="text-muted ml-3">Your account requires a code from your authenticator app at sign-in.</span>
            </p>
            <Button variant="danger" @click="onDisable2fa">Disable</Button>
          </div>
        </template>

        <template v-else>
          <p class="text-muted text-sm mb-4">
            Add an authenticator app as a second sign-in step, on top of your password.
          </p>
          <Button variant="primary" @click="startEnroll">Enable 2FA</Button>
        </template>
      </template>
    </Pane>

    <Popup v-model:open="reauthOpen" title="Confirm it's you">
      <p v-if="reauthError" class="text-danger text-sm mb-4">{{ reauthError }}</p>

      <form v-if="reauthStep === 'password'" class="space-y-5" @submit.prevent="submitReauthPassword">
        <p class="text-muted text-sm mb-2">Re-enter your password to continue.</p>
        <div>
          <label for="reauth-password" class="block text-xs font-medium text-muted mb-1.5">Password</label>
          <input
            id="reauth-password"
            v-model="reauthPassword"
            type="password"
            required
            autocomplete="current-password"
            class="w-full bg-transparent border-b border-rule focus:border-accent outline-none py-2 text-sm"
          />
        </div>
        <div class="flex gap-3">
          <Button type="submit" variant="primary" :disabled="reauthSubmitting">
            {{ reauthSubmitting ? 'Verifying…' : 'Continue' }}
          </Button>
          <Button type="button" variant="secondary" @click="reauthOpen = false">Cancel</Button>
        </div>
      </form>

      <form v-else class="space-y-5" @submit.prevent="submitReauthCode">
        <p class="text-muted text-sm mb-2">Enter the code from your authenticator app.</p>
        <div>
          <label for="reauth-code" class="block text-xs font-medium text-muted mb-1.5">Authentication code</label>
          <input
            id="reauth-code"
            v-model="reauthCode"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            required
            class="w-full bg-transparent border-b border-rule focus:border-accent outline-none py-2 text-sm mono tracking-widest"
          />
        </div>
        <div class="flex gap-3">
          <Button type="submit" variant="primary" :disabled="reauthSubmitting">
            {{ reauthSubmitting ? 'Verifying…' : 'Continue' }}
          </Button>
          <Button type="button" variant="secondary" @click="reauthOpen = false">Cancel</Button>
        </div>
      </form>
    </Popup>

    <Popup v-model:open="passwordFormOpen" title="Update password">
      <p v-if="passwordError" class="text-danger text-sm mb-4">{{ passwordError }}</p>
      <form class="space-y-5" @submit.prevent="onChangePassword">
        <div>
          <label for="new-password" class="block text-xs font-medium text-muted mb-1.5">New password</label>
          <input
            id="new-password"
            v-model="newPassword"
            type="password"
            required
            autocomplete="new-password"
            class="w-full bg-transparent border-b border-rule focus:border-accent outline-none py-2 text-sm"
          />
        </div>
        <div>
          <label for="confirm-password" class="block text-xs font-medium text-muted mb-1.5">Confirm password</label>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            required
            autocomplete="new-password"
            class="w-full bg-transparent border-b border-rule focus:border-accent outline-none py-2 text-sm"
          />
        </div>
        <div class="flex gap-3">
          <Button type="submit" variant="primary" :disabled="passwordSubmitting">
            {{ passwordSubmitting ? 'Updating…' : 'Update password' }}
          </Button>
          <Button type="button" variant="secondary" @click="passwordFormOpen = false">Cancel</Button>
        </div>
      </form>
    </Popup>
  </div>
</template>
