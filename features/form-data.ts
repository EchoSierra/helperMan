/**
 * Plain field values from a submitted form. React/Next add internal `$ACTION_*` entries
 * to forms bound to server actions; they are not user input and would trip strict schemas.
 */
export function formFields(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries([...formData.entries()].filter(([key]) => !key.startsWith('$ACTION_')));
}
