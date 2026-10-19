import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import HelperForm from '@/features/helpers/helper-form';
import QualificationForm from '@/features/qualifications/qualification-form';
import { listQualificationOptions } from '@/features/qualifications/catalog-service';
import { getHelperProfile } from '@/features/helpers/service';
import { AssignEquipmentToHelperForm, AssignNewEquipmentToHelperForm, ReturnEquipmentForm } from '@/features/equipment/equipment-forms';
import { listActiveEquipmentTypes, listAvailableEquipment } from '@/features/equipment/service';

export const dynamic = 'force-dynamic';

export default async function HelperProfilePage({
  params,
}: {
  params: Promise<{ helperId: string }>;
}) {
  const t = await getTranslations('profile');
  const equipmentT = await getTranslations('equipment');
  const { helperId } = await params;
  const helper = await getHelperProfile(helperId);
  if (!helper) notFound();
  const qualificationDefinitions = await listQualificationOptions(
    helper.qualifications.map(({ definitionId }) => definitionId),
  );
  const availableEquipment = helper.active ? await listAvailableEquipment() : [];
  const equipmentTypes = helper.active ? await listActiveEquipmentTypes() : [];

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <Link className="text-sm underline" href="/helpers">{t('page.back')}</Link>
      <header className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-3xl font-semibold">{helper.firstName} {helper.lastName}</h1>
          <p className="mt-2 text-sm text-gray-600">
            {helper.active ? t('page.activeHelper') : t('page.inactiveHelper')} · {t('page.reference', { id: helper.id })}
          </p>
        </div>
        <Link className="rounded border border-gray-400 px-4 py-2" href={`/helpers/${helper.id}/edit`}>{t('page.editProfile')}</Link>
      </header>

      <section aria-labelledby="profile-heading" className="py-8">
        <h2 className="text-xl font-semibold" id="profile-heading">{t('sections.profile.title')}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><dt className="text-sm text-gray-600">{t('sections.profile.organization')}</dt><dd>{helper.organization?.name ?? t('sections.profile.notAssigned')}</dd></div>
          <div><dt className="text-sm text-gray-600">{t('sections.profile.email')}</dt><dd>{helper.email ?? t('sections.profile.notProvided')}</dd></div>
          <div><dt className="text-sm text-gray-600">{t('sections.profile.phone')}</dt><dd>{helper.phone ?? t('sections.profile.notProvided')}</dd></div>
          <div className="sm:col-span-2"><dt className="text-sm text-gray-600">{t('sections.profile.address')}</dt><dd className="whitespace-pre-wrap">{helper.address ?? t('sections.profile.notProvided')}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="qualifications-heading" className="border-t border-gray-200 py-8">
        <h2 className="text-xl font-semibold" id="qualifications-heading">{t('sections.qualifications.title')}</h2>
        {helper.qualifications.length === 0 ? (
          <p className="mt-3 text-gray-600">{t('sections.qualifications.empty')}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {helper.qualifications.map((qualification) => (
              <div className="rounded border border-gray-200 p-4" key={qualification.id}>
                <p className="text-sm text-gray-600">{t('sections.qualifications.record', { id: qualification.id })}</p>
                <QualificationForm
                  definitions={qualificationDefinitions}
                  helperId={helper.id}
                  qualification={qualification}
                />
              </div>
            ))}
          </div>
        )}
        <QualificationForm definitions={qualificationDefinitions} helperId={helper.id} />
      </section>
      <section aria-labelledby="equipment-heading" className="border-t border-gray-200 py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold" id="equipment-heading">{t('sections.equipment.title')}</h2>
          <Link className="text-sm underline" href="/equipment">{t('sections.equipment.manage')}</Link>
        </div>
        {!helper.active ? (
          <p className="mt-3 text-sm text-gray-600">{t('sections.equipment.inactive')}</p>
        ) : (
          <>
            {equipmentTypes.length > 0 ? (
              <AssignNewEquipmentToHelperForm helperId={helper.id} types={equipmentTypes} />
            ) : (
              <p className="mt-3 text-sm text-gray-600">
                <Link className="underline" href="/equipment">{t('sections.equipment.addTypeFirstLink')}</Link>
              </p>
            )}
            {availableEquipment.length > 0 && (
              <AssignEquipmentToHelperForm helperId={helper.id} items={availableEquipment} />
            )}
          </>
        )}
        {helper.equipment.length === 0 ? (
          <p className="mt-3 text-gray-600">{t('sections.equipment.empty')}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {helper.equipment.map((item) => (
              <li className="rounded border border-gray-200 p-4" key={item.assignmentId}>
                <p className="font-medium">{item.equipmentTypeName}</p>
                <p className="mt-1 text-sm text-gray-600">
                  {item.assetLabel ?? equipmentT('item.referenceFallback', { id: item.itemId })} · {equipmentT(`equipmentStatus.${item.status}`)}
                </p>
                {item.status === 'ASSIGNED' && <ReturnEquipmentForm itemId={item.itemId} label={t('sections.equipment.removeFromHelper')} />}
              </li>
            ))}
          </ul>
        )}
      </section>
      <Link className="inline-block underline" href="/reports/qualification-expiry">{t('sections.reports.qualificationExpiry')}</Link>
    </main>
  );
}
