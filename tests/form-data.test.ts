import { describe, expect, it } from 'vitest';
import { formFields } from '@/features/form-data';

describe('formFields', () => {
  it('drops framework $ACTION_ entries and keeps user fields', () => {
    const form = new FormData();
    form.set('$ACTION_REF_1', '');
    form.set('$ACTION_KEY', 'k');
    form.set('title', 'First aid');
    expect(formFields(form)).toEqual({ title: 'First aid' });
  });
});
