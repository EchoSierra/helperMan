'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { HelperFormData } from './service';
import type { FormActionState } from './action-state';
import { createHelperAction, updateHelperAction } from './actions';

type HelperFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  active: string;
};

function initialValues(helper?: HelperFormData): HelperFormValues {
  return {
    firstName: helper?.firstName ?? '',
    lastName: helper?.lastName ?? '',
    email: helper?.email ?? '',
    phone: helper?.phone ?? '',
    address: helper?.address ?? '',
    active: helper?.active === false ? 'false' : 'true',
  };
}

export default function HelperForm({ helper }: { helper?: HelperFormData }) {
  const router = useRouter();
  const [values, setValues] = useState(() => initialValues(helper));
  const helperId = helper?.id;
  const action = useMemo(
    () => (helperId ? updateHelperAction.bind(null, helperId) : createHelperAction),
    [helperId],
  );
  const [state, formAction, pending] = useActionState<FormActionState, FormData>(action, {});

  useEffect(() => {
    if (state.helperId) router.replace(`/helpers/${state.helperId}`);
    else if (state.successToken && helperId) router.replace(`/helpers/${helperId}`);
  }, [helperId, router, state.helperId, state.successToken]);

  function updateField(name: keyof HelperFormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  return (
    <form action={formAction} className="mt-6 max-w-2xl space-y-5">
      {state.message && <p className="text-sm text-red-700" role="alert">{state.message}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">First name</span>
          <input className="w-full rounded border border-gray-300 px-3 py-2" maxLength={100} name="firstName" onChange={(event) => updateField('firstName', event.target.value)} required value={values.firstName} />
          {state.fieldErrors?.firstName?.map((message) => <span className="block text-sm text-red-700" key={message}>{message}</span>)}
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Last name</span>
          <input className="w-full rounded border border-gray-300 px-3 py-2" maxLength={100} name="lastName" onChange={(event) => updateField('lastName', event.target.value)} required value={values.lastName} />
          {state.fieldErrors?.lastName?.map((message) => <span className="block text-sm text-red-700" key={message}>{message}</span>)}
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Email (optional)</span>
        <input autoComplete="off" className="w-full rounded border border-gray-300 px-3 py-2" maxLength={254} name="email" onChange={(event) => updateField('email', event.target.value)} type="email" value={values.email} />
        {state.fieldErrors?.email?.map((message) => <span className="block text-sm text-red-700" key={message}>{message}</span>)}
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Phone (optional)</span>
        <input autoComplete="off" className="w-full rounded border border-gray-300 px-3 py-2" maxLength={50} name="phone" onChange={(event) => updateField('phone', event.target.value)} value={values.phone} />
        {state.fieldErrors?.phone?.map((message) => <span className="block text-sm text-red-700" key={message}>{message}</span>)}
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Address (optional)</span>
        <textarea className="w-full rounded border border-gray-300 px-3 py-2" maxLength={300} name="address" onChange={(event) => updateField('address', event.target.value)} rows={3} value={values.address} />
        {state.fieldErrors?.address?.map((message) => <span className="block text-sm text-red-700" key={message}>{message}</span>)}
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Status</span>
        <select className="w-full rounded border border-gray-300 px-3 py-2" name="active" onChange={(event) => updateField('active', event.target.value)} value={values.active}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </label>
      <button className="rounded bg-black px-4 py-2 font-medium text-white disabled:opacity-50" disabled={pending} type="submit">
        {pending ? 'Saving…' : helper ? 'Save profile' : 'Create helper'}
      </button>
    </form>
  );
}
