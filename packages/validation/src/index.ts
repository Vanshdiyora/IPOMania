export { z } from "zod";

import { z } from "zod";

export const registerSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address."),
    fullName: z.string().trim().min(1, "Enter your name.").max(120, "Use 120 characters or fewer."),
    password: z.string().min(12, "Use at least 12 characters."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(12, "Use at least 12 characters."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const profileUpdateSchema = z
  .object({
    full_name: z.string().trim().min(1).max(120),
  })
  .strict();

export const preferencesUpdateSchema = z
  .object({
    email_notifications: z.boolean(),
    timezone: z.string().trim().min(1).max(64),
  })
  .strict();

export const depositoryTypeSchema = z.enum(["NSDL", "CDSL"]);
export const accountStatusSchema = z.enum(["active", "inactive", "closed"]);

export const dematAccountSchema = z
  .object({
    holder_name: z.string().trim().min(1).max(160),
    broker_name: z.string().trim().min(1).max(120),
    broker_code: z.string().trim().min(1).max(40).nullable().optional(),
    depository_type: depositoryTypeSchema,
    masked_demat_identifier: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/[xX*]/, "Use a masked identifier containing X or * characters."),
    masked_client_reference: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/[xX*]/, "Use a masked reference containing X or * characters.")
      .nullable()
      .optional(),
    account_status: accountStatusSchema.default("active"),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const dematAccountUpdateSchema = dematAccountSchema.partial().strict();

export const accountListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    holder_name: z.string().trim().max(160).optional(),
    broker: z.string().trim().max(120).optional(),
    depository: depositoryTypeSchema.optional(),
    status: accountStatusSchema.optional(),
    created_from: z.iso.datetime().optional(),
    created_to: z.iso.datetime().optional(),
    archived: z.enum(["true", "false", "all"]).default("false"),
  })
  .strict()
  .refine(
    (query) =>
      !query.created_from ||
      !query.created_to ||
      new Date(query.created_from) <= new Date(query.created_to),
    { message: "created_from must be earlier than created_to.", path: ["created_from"] },
  );

export const accountImportRowSchema = dematAccountSchema.extend({
  row_number: z.number().int().min(1).max(500),
});

export const accountImportPreviewSchema = z
  .object({
    file_name: z.string().trim().min(1).max(255),
    file_type: z.enum([
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]),
    rows: z.array(z.unknown()).min(1).max(500),
  })
  .strict();
