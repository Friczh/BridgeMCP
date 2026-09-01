import { z } from 'zod';

export const createTokenSchema = z.object({
  name: z.string().min(1).max(128),
  expiry: z.preprocess(
    (val) => val ?? 'never',
    z.enum(['30d', '90d', '1y', 'never'])
  ),
});

export type CreateTokenInput = z.infer<typeof createTokenSchema>;