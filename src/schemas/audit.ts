import { z } from 'zod';

// uuid or the literal sentinel "null" (matches rows where the FK was
// nulled by `on delete set null` — orphaned connection/token).
const uuidOrNullSentinel = z
  .string()
  .refine((v) => v === 'null' || z.string().uuid().safeParse(v).success, {
    message: 'must be a uuid or the literal "null"',
  });

export const auditQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  tool_name: z.string().min(1).max(256).optional(),
  success: z.enum(['true', 'false']).optional(),
  date_from: z.string().min(1).optional(),
  date_to: z.string().min(1).optional(),
  connection_id: uuidOrNullSentinel.optional(),
  bridge_token_id: uuidOrNullSentinel.optional(),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;

export const auditStatsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(7),
});

export type AuditStatsQuery = z.infer<typeof auditStatsQuerySchema>;
