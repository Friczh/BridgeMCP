import { z } from 'zod';

export const createConnectionSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, 'name must be alphanumeric, dash, or underscore only (used as tool namespace prefix)'),
  server_url: z.string().url(),
  auth_type: z.enum(['bearer', 'header', 'none']),
  credentials: z
    .object({
      header: z.string().min(1).optional(),
      value: z.string().min(1),
    })
    .optional(),
});

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;
