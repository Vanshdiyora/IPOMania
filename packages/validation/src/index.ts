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
