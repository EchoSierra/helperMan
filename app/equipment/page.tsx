import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  CreateEquipmentItemForm,
  CreateEquipmentTypeForm,
  DeleteEquipmentTypeForm,
  EditEquipmentTypeForm,
  EquipmentItemCard,
} from '@/features/equipment/equipment-forms';
import { listEquipmentWorkspace } from '@/features/equipment/service';

export const dynamic = 'force-dynamic';

export default async function EquipmentPage() {
  const t = await getTranslations('equipment');
  const { types, helpers } = await listEquipmentWorkspace();
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <Link className="text-sm underline" href="/">{t('page.back')}</Link>
      <h1 className="mt-5 text-3xl font-semibold">{t('page.title')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-gray-600">
        {t('page.description')}
      </p>
      <CreateEquipmentTypeForm />
      <section aria-label={t('page.typesAriaLabel')} className="mt-8 space-y-6">
        {types.length === 0 ? (
          <p className="text-gray-600">{t('page.emptyTypes')}</p>
        ) : (
          types.map((type) => (
            <section aria-label={type.name} className="rounded-lg border border-gray-300 p-5" key={type.id}>
              <EditEquipmentTypeForm type={type} />
              <div className="mt-4">
                {type.retired ? (
                  <p className="text-sm text-gray-600">{t('page.typeRetired')}</p>
                ) : (
                  <CreateEquipmentItemForm typeId={type.id} />
                )}
              </div>
              <div className="mt-4 space-y-3">
                {type.items.length === 0 ? (
                  <p className="text-sm text-gray-600">{t('page.emptyItems')}</p>
                ) : (
                  type.items.map((item) => <EquipmentItemCard item={item} helpers={helpers} key={item.id} />)
                )}
              </div>
              <div className="mt-4">
                <DeleteEquipmentTypeForm type={type} />
              </div>
            </section>
          ))
        )}
      </section>
    </main>
  );
}
