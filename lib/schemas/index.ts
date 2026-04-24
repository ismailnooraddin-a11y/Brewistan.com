import { z } from 'zod';

export const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
export const slugRegex = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$/;
export const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

export const signUpSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name is required').max(80),
  owner_phone: z.string().regex(phoneRegex, 'Enter a valid phone number'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Minimum 8 characters').max(72),
  cafe_name: z.string().trim().min(2, 'Café name is required').max(60),
  slug: z.string().trim().toLowerCase().regex(slugRegex, 'Lowercase letters, numbers, hyphens (3–40 chars)'),
  cafe_phone: z.string().regex(phoneRegex, 'Enter a valid café phone'),
  city: z.string().trim().min(2).max(60).default('Erbil'),
  address: z.string().trim().min(4).max(200),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const brandSchema = z.object({
  cafe_name: z.string().trim().min(2).max(60),
  card_primary: z.string().regex(hexColorRegex, 'Must be #RRGGBB'),
  card_secondary: z.string().regex(hexColorRegex, 'Must be #RRGGBB'),
  card_text: z.string().regex(hexColorRegex),
  card_opacity: z.coerce.number().min(0.5).max(1),
  watermark_on: z.boolean(),
});

export const campaignSchema = z.object({
  name: z.string().trim().min(2).max(60),
  stamps_required: z.coerce.number().int().min(3).max(50),
  reward_text: z.string().trim().min(2).max(120),
  status: z.enum(['draft', 'active', 'paused', 'archived']),
});

export const branchSchema = z.object({
  name: z.string().trim().min(2).max(60),
  address: z.string().trim().min(4).max(200),
  phone: z.string().regex(phoneRegex).or(z.literal('')).optional(),
});

export const settingsSchema = z.object({
  cafe_name: z.string().trim().min(2).max(60),
  contact_email: z.string().trim().toLowerCase().email(),
  contact_phone: z.string().regex(phoneRegex),
  city: z.string().trim().min(2).max(60),
  address: z.string().trim().min(4).max(200),
});
