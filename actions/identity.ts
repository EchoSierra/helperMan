import { z } from 'zod';
import prisma from '@/lib/db';

/**
 * Service layer for Identity management.
 * Handles all interactions with the Identity record.
 */
export async function getIdentityById(id: string) {
  try {
    const identity = await prisma.identity.findUnique({
      where: { id },
      include: { user: true },
    });
    return identity;
  } catch (error) {
    console.error('Error fetching identity:', error);
    throw new Error('Failed to fetch identity record.');
  }
}

export async function createIdentity(data: unknown) {
  const validatedData = z.object({
    userId: z.string(),
    profileData: z.any().optional(),
  }).parse(data);

  try {
    const newIdentity = await prisma.identity.create({
      data: {
        userId: validatedData.userId,
        profileData: validatedData.profileData,
      },
    });
    return newIdentity;
  } catch (error) {
    console.error('Error creating identity:', error);
    throw new Error('Failed to create identity record.');
  }
}

export async function updateIdentity(id: string, data: unknown) {
  const validatedData = z.object({
    profileData: z.any().optional(),
  }).parse(data);

  try {
    const updated = await prisma.identity.update({
      where: { id },
      data: {
        profileData: validatedData.profileData,
      },
    });
    return updated;
  } catch (error) {
    console.error('Error updating identity:', error);
    throw new Error('Failed to update identity record.');
  }
}

export async function listIdentities() {
  try {
    return await prisma.identity.findMany({
      include: { user: true },
    });
  } catch (error) {
    console.error('Error listing identities:', error);
    throw new Error('Failed to fetch identity list.');
  }
}
