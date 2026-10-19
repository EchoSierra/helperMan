'use client';

import { useActionState, useMemo, useState } from 'react';
import type { EquipmentStatus } from '@prisma/client';
import { useTranslations } from 'next-intl';
import {
  assignEquipmentAction,
  assignEquipmentToHelperAction,
  assignNewEquipmentToHelperAction,
  changeEquipmentStatusAction,
  createEquipmentItemAction,
  createEquipmentTypeAction,
  deleteEquipmentTypeAction,
  returnEquipmentAction,
  updateEquipmentTypeAction,
  type EquipmentActionState,
} from './actions';
import type {
  ActiveEquipmentTypeOption,
  AvailableEquipmentOption,
  EquipmentHelperOption,
  EquipmentItemView,
  EquipmentTypeView,
} from './service';

function equipmentStatusLabel(t: ReturnType<typeof useTranslations<'equipment'>>, status: EquipmentStatus) {
  return t(`equipmentStatus.${status}`);
}

export function CreateEquipmentTypeForm() {
  const t = useTranslations('equipment');
  const [state, action, pending] = useActionState<EquipmentActionState, FormData>(createEquipmentTypeAction, {});
  return (
    <form action={action} className="mt-4 flex max-w-xl flex-wrap items-end gap-3" key={state.successToken ?? 0}>
      <label className="block flex-1 space-y-1">
        <span className="text-sm font-medium">{t('forms.createType.label')}</span>
        <input className="w-full rounded border border-gray-300 px-3 py-2" maxLength={200} name="name" required />
      </label>
      <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" disabled={pending} type="submit">
        {pending ? t('forms.createType.pending') : t('forms.createType.submit')}
      </button>
      {state.message && <p className="w-full text-sm text-red-700" role="alert">{state.message}</p>}
    </form>
  );
}

export function EditEquipmentTypeForm({ type }: { type: Pick<EquipmentTypeView, 'id' | 'name' | 'retired'> }) {
  const t = useTranslations('equipment');
  const action = useMemo(() => updateEquipmentTypeAction.bind(null, type.id), [type.id]);
  const [state, formAction, pending] = useActionState<EquipmentActionState, FormData>(action, {});
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
      <label className="space-y-1">
        <span className="block text-sm font-medium">{t('forms.editType.nameLabel')}</span>
        <input className="w-full rounded border border-gray-300 px-3 py-2" defaultValue={type.name} maxLength={200} name="name" required />
      </label>
      <label className="space-y-1">
        <span className="block text-sm font-medium">{t('forms.editType.statusLabel')}</span>
        <select className="w-full rounded border border-gray-300 px-3 py-2" defaultValue={type.retired ? 'true' : 'false'} name="retired">
          <option value="false">{t('typeStatus.active')}</option>
          <option value="true">{t('typeStatus.retired')}</option>
        </select>
      </label>
      <button className="rounded border border-gray-400 px-4 py-2 disabled:opacity-50" disabled={pending} type="submit">
        {pending ? t('common.saving') : t('common.save')}
      </button>
      {state.message && <p className="text-sm sm:col-span-3" role={state.successToken ? 'status' : 'alert'}>{state.message}</p>}
    </form>
  );
}

export function DeleteEquipmentTypeForm({ type }: { type: Pick<EquipmentTypeView, 'id' | 'name'> }) {
  const t = useTranslations('equipment');
  const action = useMemo(() => deleteEquipmentTypeAction.bind(null, type.id), [type.id]);
  const [state, formAction, pending] = useActionState<EquipmentActionState, FormData>(action, {});
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button className="rounded border border-red-300 px-4 py-2 text-red-700" onClick={() => setConfirming(true)} type="button">
        {t('forms.deleteType.open')}
      </button>
    );
  }
  return (
    <form action={formAction} className="space-y-3 rounded border border-red-300 bg-red-50 p-4">
      <p className="text-sm text-red-800" role="alert">
        {t('forms.deleteType.warning', { name: type.name })}
      </p>
      <div className="flex gap-3">
        <button className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50" disabled={pending} type="submit">
          {pending ? t('forms.deleteType.pending') : t('forms.deleteType.submit')}
        </button>
        <button className="rounded border border-gray-400 px-4 py-2" disabled={pending} onClick={() => setConfirming(false)} type="button">
          {t('common.cancel')}
        </button>
      </div>
      {state.message && <p className="text-sm text-red-700" role="alert">{state.message}</p>}
    </form>
  );
}

export function CreateEquipmentItemForm({ typeId }: { typeId: string }) {
  const t = useTranslations('equipment');
  const action = useMemo(() => createEquipmentItemAction.bind(null, typeId), [typeId]);
  const [state, formAction, pending] = useActionState<EquipmentActionState, FormData>(action, {});
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3" key={state.successToken ?? 0}>
      <label className="flex-1 space-y-1">
        <span className="block text-sm font-medium">{t('forms.createItem.assetLabel')}</span>
        <input className="w-full rounded border border-gray-300 px-3 py-2" maxLength={100} name="assetLabel" />
      </label>
      <button className="rounded border border-gray-400 px-4 py-2 disabled:opacity-50" disabled={pending} type="submit">
        {pending ? t('forms.createItem.pending') : t('forms.createItem.submit')}
      </button>
      {state.message && <p className="w-full text-sm text-red-700" role="alert">{state.message}</p>}
    </form>
  );
}

function AssignEquipmentForm({
  item,
  helpers,
}: {
  item: EquipmentItemView;
  helpers: EquipmentHelperOption[];
}) {
  const t = useTranslations('equipment');
  const action = useMemo(() => assignEquipmentAction.bind(null, item.id), [item.id]);
  const [state, formAction, pending] = useActionState<EquipmentActionState, FormData>(action, {});
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="flex-1 space-y-1">
        <span className="block text-sm font-medium">{t('forms.assignExisting.helperLabel')}</span>
        <select className="w-full rounded border border-gray-300 px-3 py-2" defaultValue="" name="helperId" required>
          <option disabled value="">{t('forms.assignExisting.helperPlaceholder')}</option>
          {helpers.map((helper) => <option key={helper.id} value={helper.id}>{helper.name}</option>)}
        </select>
      </label>
      <button className="rounded border border-gray-400 px-4 py-2 disabled:opacity-50" disabled={pending || helpers.length === 0} type="submit">
        {pending ? t('forms.assignExisting.pending') : t('forms.assignExisting.submit')}
      </button>
      {state.message && <p className="w-full text-sm text-red-700" role="alert">{state.message}</p>}
    </form>
  );
}

export function AssignEquipmentToHelperForm({
  helperId,
  items,
}: {
  helperId: string;
  items: AvailableEquipmentOption[];
}) {
  const t = useTranslations('equipment');
  const action = useMemo(() => assignEquipmentToHelperAction.bind(null, helperId), [helperId]);
  const [state, formAction, pending] = useActionState<EquipmentActionState, FormData>(action, {});
  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3" key={state.successToken ?? 0}>
      <label className="flex-1 space-y-1">
        <span className="block text-sm font-medium">{t('forms.assignToHelper.itemLabel')}</span>
        <select className="w-full rounded border border-gray-300 px-3 py-2" defaultValue="" name="itemId" required>
          <option disabled value="">{t('forms.assignToHelper.itemPlaceholder')}</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.equipmentTypeName} · {item.assetLabel ?? t('item.referenceFallback', { id: item.id })}
            </option>
          ))}
        </select>
      </label>
      <button
        className="rounded border border-gray-400 px-4 py-2 disabled:opacity-50"
        disabled={pending || items.length === 0}
        type="submit"
      >
        {pending ? t('forms.assignToHelper.pending') : t('forms.assignToHelper.submit')}
      </button>
      {state.message && (
        <p className="w-full text-sm" role={state.successToken ? 'status' : 'alert'}>{state.message}</p>
      )}
    </form>
  );
}

export function AssignNewEquipmentToHelperForm({
  helperId,
  types,
}: {
  helperId: string;
  types: ActiveEquipmentTypeOption[];
}) {
  const t = useTranslations('equipment');
  const action = useMemo(() => assignNewEquipmentToHelperAction.bind(null, helperId), [helperId]);
  const [state, formAction, pending] = useActionState<EquipmentActionState, FormData>(action, {});
  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3" key={state.successToken ?? 0}>
      <label className="flex-1 space-y-1">
        <span className="block text-sm font-medium">{t('forms.assignNew.typeLabel')}</span>
        <select className="w-full rounded border border-gray-300 px-3 py-2" defaultValue="" name="equipmentTypeId" required>
          <option disabled value="">{t('forms.assignNew.typePlaceholder')}</option>
          {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
      </label>
      <label className="flex-1 space-y-1">
        <span className="block text-sm font-medium">{t('forms.assignNew.assetLabel')}</span>
        <input className="w-full rounded border border-gray-300 px-3 py-2" maxLength={100} name="assetLabel" />
      </label>
      <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" disabled={pending || types.length === 0} type="submit">
        {pending ? t('forms.assignNew.pending') : t('forms.assignNew.submit')}
      </button>
      {state.message && <p className="w-full text-sm text-red-700" role="alert">{state.message}</p>}
    </form>
  );
}

export function ReturnEquipmentForm({ itemId, label }: { itemId: string; label?: string }) {
  const t = useTranslations('equipment');
  const action = useMemo(() => returnEquipmentAction.bind(null, itemId), [itemId]);
  const [state, formAction, pending] = useActionState<EquipmentActionState, FormData>(action, {});
  return (
    <form action={formAction} className="mt-3">
      <button className="rounded border border-gray-400 px-4 py-2 disabled:opacity-50" disabled={pending} type="submit">
        {pending ? t('forms.returnItem.pending') : (label ?? t('forms.returnItem.submit'))}
      </button>
      {state.message && <p className="mt-2 text-sm text-red-700" role="alert">{state.message}</p>}
    </form>
  );
}

function EquipmentStatusForm({ item }: { item: EquipmentItemView }) {
  const t = useTranslations('equipment');
  const action = useMemo(() => changeEquipmentStatusAction.bind(null, item.id), [item.id]);
  const [state, formAction, pending] = useActionState<EquipmentActionState, FormData>(action, {});
  if (item.status === 'RETIRED') return <p className="mt-2 text-sm text-gray-600">{t('forms.changeStatus.retiredLocked')}</p>;
  if (item.status === 'ASSIGNED') return null;
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="space-y-1">
        <span className="block text-sm font-medium">{t('forms.changeStatus.label')}</span>
        <select className="rounded border border-gray-300 px-3 py-2" defaultValue={item.status} name="status">
          {item.status === 'IN_REPAIR' ? (
            <>
              <option value="IN_REPAIR">{equipmentStatusLabel(t, 'IN_REPAIR')}</option>
              <option value="AVAILABLE">{equipmentStatusLabel(t, 'AVAILABLE')}</option>
              <option value="RETIRED">{equipmentStatusLabel(t, 'RETIRED')}</option>
            </>
          ) : (
            <>
              <option value="AVAILABLE">{equipmentStatusLabel(t, 'AVAILABLE')}</option>
              <option value="IN_REPAIR">{equipmentStatusLabel(t, 'IN_REPAIR')}</option>
              <option value="RETIRED">{equipmentStatusLabel(t, 'RETIRED')}</option>
            </>
          )}
        </select>
      </label>
      <button className="rounded border border-gray-400 px-4 py-2 disabled:opacity-50" disabled={pending} type="submit">
        {pending ? t('common.saving') : t('forms.changeStatus.submit')}
      </button>
      {state.message && <p className="w-full text-sm" role={state.successToken ? 'status' : 'alert'}>{state.message}</p>}
    </form>
  );
}

export function EquipmentItemCard({
  item,
  helpers,
}: {
  item: EquipmentItemView;
  helpers: EquipmentHelperOption[];
}) {
  const t = useTranslations('equipment');
  return (
    <article className="rounded border border-gray-200 p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <h3 className="font-medium">{item.assetLabel || t('item.defaultName')}</h3>
          <p className="text-sm text-gray-600">{t('item.reference', { id: item.id })}</p>
        </div>
        <span className="text-sm font-medium">{equipmentStatusLabel(t, item.status)}</span>
      </div>
      {item.currentAssignment && (
        <p className="mt-2 text-sm text-gray-700">{t('item.assignedTo', { name: item.currentAssignment.helperName })}</p>
      )}
      {item.status === 'AVAILABLE' && <AssignEquipmentForm helpers={helpers} item={item} />}
      {item.status === 'ASSIGNED' && item.currentAssignment && <ReturnEquipmentForm itemId={item.id} />}
      {item.status === 'ASSIGNED' && !item.currentAssignment && (
        <p className="mt-2 text-sm text-red-700" role="alert">{t('item.inconsistentAssignment')}</p>
      )}
      <EquipmentStatusForm item={item} />
    </article>
  );
}
