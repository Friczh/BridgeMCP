import { z } from 'zod';

export const reauthPasswordSchema = z.object({
  password: z.string().min(1),
});

export const reauthMfaSchema = z.object({
  partial_token: z.string().min(1),
  code: z.string().length(6),
});

export const updatePasswordSchema = z.object({
  password: z.string().min(8),
});
