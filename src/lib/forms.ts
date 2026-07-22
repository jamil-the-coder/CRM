import { z } from "zod";

export const HONEYPOT_FIELD_NAME = "website";

export const formFieldSchema = z.object({
  name: z.enum(["firstName", "lastName", "email", "phone", "company"]),
  label: z.string().trim().min(1).max(100),
  required: z.boolean(),
});

export type FormField = z.infer<typeof formFieldSchema>;

export const DEFAULT_FORM_FIELDS: FormField[] = [
  { name: "firstName", label: "Name", required: true },
  { name: "email", label: "Email", required: true },
  { name: "phone", label: "Phone", required: false },
  { name: "company", label: "Company", required: false },
];

export const formFieldsSchema = z.array(formFieldSchema).min(1).max(10);
