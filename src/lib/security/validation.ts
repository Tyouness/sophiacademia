import { z } from "zod";

export const emailSchema = z.string().trim().email().max(320);
const passwordSchema = z.string().min(8).max(72);

export const loginSchema = z.object({
  email: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    emailSchema,
  ),
  password: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    passwordSchema,
  ),
});

export const forgotSchema = z.object({
  email: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    emailSchema,
  ),
});

export const setPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const createUserSchema = z.object({
  role: z.enum(["admin", "staff", "professor", "family"]),
  email: emailSchema,
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(40).optional().or(z.literal("")),
  birthDate: z.string().trim().optional().or(z.literal("")),
});

const addressSchema = z.object({
  addr1: z.string().trim().min(2).max(200),
  addr2: z.string().trim().max(200).optional().or(z.literal("")),
  postcode: z.string().trim().min(3).max(16),
  city: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(120),
});

export const familyProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(40).optional().or(z.literal("")),
  fiscalNumber: z.string().trim().regex(/^\d{14}$/).optional().or(z.literal("")),
  fiscalConsent: z.boolean().optional(),
  mandateConsent: z.boolean().optional(),
  legalNoticeAccepted: z.boolean().optional(),
  address: addressSchema,
});

export const professorProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(40).optional().or(z.literal("")),
  birthDate: z.string().trim().optional().or(z.literal("")),
  employmentStatus: z.enum(["student", "employee", "self_employed", "other"]).optional(),
  carHp: z
    .preprocess((value) => (value === "" ? undefined : value), z.number().int().min(0))
    .optional(),
  address: addressSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotInput = z.infer<typeof forgotSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type FamilyProfileInput = z.infer<typeof familyProfileSchema>;
export type ProfessorProfileInput = z.infer<typeof professorProfileSchema>;

export function parseLoginInput(formData: FormData) {
  return loginSchema.parse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

export function parseForgotInput(formData: FormData) {
  return forgotSchema.parse({
    email: formData.get("email"),
  });
}

export function parseSetPasswordInput(formData: FormData) {
  return setPasswordSchema.parse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
}
