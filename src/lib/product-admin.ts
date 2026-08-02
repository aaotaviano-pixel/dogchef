import { z } from "zod";

export const productInputSchema = z.object({
  categoryId: z.string().trim().min(1).max(80),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1200).default(""),
  priceCents: z.number().int().min(0).max(10_000_000),
  prepMinutes: z.number().int().min(0).max(240),
  isAvailable: z.boolean(),
  featured: z.boolean(),
  highlight: z.string().trim().max(40).optional(),
});

const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export function parseProductFormData(formData: FormData) {
  const rawPayload = formData.get("payload");
  if (typeof rawPayload !== "string") throw new Error("Os dados do produto não foram enviados.");
  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    throw new Error("Os dados do produto estão inválidos.");
  }
  const parsed = productInputSchema.safeParse(payload);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Confira os campos do produto.");
  const files = formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > 12) throw new Error("Envie no máximo 12 fotos de cada vez.");
  for (const file of files) {
    if (!acceptedImageTypes.has(file.type)) throw new Error("Use apenas fotos JPG, PNG, WEBP ou AVIF.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Cada foto pode ter no máximo 8 MB.");
  }
  return { input: parsed.data, files };
}

export function parseImageFormData(formData: FormData) {
  const files = formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
  if (!files.length) throw new Error("Escolha ao menos uma foto.");
  if (files.length > 12) throw new Error("Envie no máximo 12 fotos de cada vez.");
  for (const file of files) {
    if (!acceptedImageTypes.has(file.type)) throw new Error("Use apenas fotos JPG, PNG, WEBP ou AVIF.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Cada foto pode ter no máximo 8 MB.");
  }
  return files;
}
