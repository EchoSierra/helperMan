import { z } from 'zod';
import prisma from '@/lib/db';

/**
 * Service layer for Qualification management.
 * Handles the complex multi-dimensional listing of skills and certifications.
 */
export async function listQualifications() {
  try {
    // We return all qualifications, including the dynamic metadata
    return await prisma.qualification.findMany({
      orderBy: { title: 'asc' },
    });
  } catch (error) {
    console.error('Error listing qualifications:', error);
    throw new Error('Failed to fetch qualifications.');
  }
}

export async function getQualificationById(id: string) {
  try {
    const qualification = await prisma.qualification.findUnique({
      where: { id },
    });
    return qualification;
  } catch (error) {
    console.error('Error fetching qualification:', error);
    throw new Error('Failed to fetch qualification.');
  }
}

export async function createQualification(data: unknown) {
  const validatedData = z.object({
    userId: z.string().optional(),
    title: z.string().min(1, "Title is required"),
    category: z.string().optional(),
    issuer: z.string().optional(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
    isVerified: z.boolean().default(false),
    metadata: z.any().optional(),
  }).parse(data);

  try {
    const newQual = await prisma.qualification.create({
      data: {
        title: validatedData.title,
        category: validatedData.category,
        issuer: validatedData.issuer,
        validFrom: validatedData.validFrom,
        validUntil: validatedData.validUntil,
        isVerified: validatedData.isVerified,
        metadata: validatedData.metadata,
        userId: validatedData.userId,
      },
    });
    return newQual;
  } catch (error) {
    console.error('Error creating qualification:', error);
    throw new Error('Failed to create qualification.');
  }
}

export async function updateQualification(id: string, data: unknown) {
  const validatedData = z.object({
    title: z.string().optional(),
    category: z.string().optional(),
    issuer: z.string().optional(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
    isVerified: z.boolean().optional(),
    metadata: z.any().optional(),
  }).parse(data);

  try {
    const updated = await prisma.qualification.update({
      where: { id },
      data: {
        title: validatedData.title ?? undefined,
        category: validatedData.category ?? undefined,
        issuer: validatedData.issuer ?? undefined,
        validFrom: validatedData.validFrom ?? undefined,
        validUntil: validatedData.validUntil ?? undefined,
        isVerified: validatedData.isVerified !== undefined ? validatedData.isVerified : undefined,
        metadata: validatedData.metadata ?? undefined,
      },
    });
    return updated;
  } catch (error) {
    console.error('Error updating qualification:', error);
    throw new Error('Failed to update qualification.');
  }
}
