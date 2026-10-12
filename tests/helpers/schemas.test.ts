import { describe, expect, it } from 'vitest';
import {
  createHelperSchema,
  createQualificationSchema,
  directorySearchSchema,
  helperFormSchema,
  updateQualificationSchema,
} from '@/features/helpers/schemas';

describe('helper input schemas', () => {
  it('requires names and normalizes empty optional profile fields', () => {
    const result = createHelperSchema.safeParse({
      firstName: '  Ada ',
      lastName: ' Lovelace ',
      email: '',
      phone: ' ',
      address: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: null,
        phone: null,
        address: null,
        active: true,
      });
    }
    expect(createHelperSchema.safeParse({ firstName: '', lastName: 'Lovelace' }).success).toBe(false);
    expect(createHelperSchema.safeParse({ firstName: 'Ada', lastName: 'Lovelace', notes: 'extra' }).success).toBe(false);
  });

  it('accepts only valid optional emails and explicit form status values', () => {
    expect(createHelperSchema.safeParse({ firstName: 'Ada', lastName: 'Lovelace', email: 'not-an-email' }).success).toBe(false);
    expect(helperFormSchema.safeParse({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: '',
      phone: '',
      address: '',
      active: 'false',
    }).success).toBe(true);
    expect(helperFormSchema.safeParse({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: '',
      phone: '',
      address: '',
      active: 'yes',
    }).success).toBe(false);
  });

  it('bounds directory search and validates an optional cursor', () => {
    expect(directorySearchSchema.safeParse({ search: ' Ada ', cursorId: '' }).success).toBe(true);
    expect(directorySearchSchema.safeParse({ search: 'x'.repeat(101), cursorId: '' }).success).toBe(false);
    expect(directorySearchSchema.safeParse({ search: '', cursorId: '', personalData: 'unexpected' }).success).toBe(false);
  });
});

describe('qualification input schemas', () => {
  it('requires a title and accepts only date-only valid-through values', () => {
    expect(createQualificationSchema.safeParse({ helperId: 'helper-1', title: 'First aid', validThrough: '' }).success).toBe(true);
    expect(createQualificationSchema.safeParse({ helperId: 'helper-1', title: ' ', validThrough: null }).success).toBe(false);
    expect(createQualificationSchema.safeParse({ helperId: 'helper-1', title: 'First aid', validThrough: '2030-02-30' }).success).toBe(false);
    expect(createQualificationSchema.safeParse({ helperId: 'helper-1', title: 'First aid', validThrough: '2030-02-01T00:00:00Z' }).success).toBe(false);
  });

  it('requires helper and qualification IDs on updates and rejects extra fields', () => {
    expect(updateQualificationSchema.safeParse({
      helperId: 'helper-1',
      qualificationId: 'qualification-1',
      title: 'First aid',
      validThrough: null,
    }).success).toBe(true);
    expect(updateQualificationSchema.safeParse({
      helperId: 'helper-1',
      qualificationId: 'qualification-1',
      title: 'First aid',
      validThrough: null,
      actorId: 'forged',
    }).success).toBe(false);
  });
});
