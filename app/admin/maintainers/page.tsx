import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { listAccounts } from '@/features/accounts/service';
import {
  createMaintainerAction,
  deleteMaintainerAction,
  grantAdminRoleAction,
  grantMaintainerRoleAction,
  revokeAdminRoleAction,
  revokeMaintainerRoleAction,
  resetPasswordAction,
  resetTotpAction,
  revokeSessionsAction,
  setDisabledAction,
} from '@/features/accounts/actions';
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '@/lib/auth/policy';

export const dynamic = 'force-dynamic';

const STATUS_KEYS = {
  'role-granted': 'maintainerGranted',
  'role-revoked': 'maintainerRevoked',
  'admin-granted': 'adminGranted',
  'admin-revoked': 'adminRevoked',
  deleted: 'deleted',
  created: 'created',
  disabled: 'disabled',
  enabled: 'enabled',
  'sessions-revoked': 'sessionsRevoked',
  'totp-reset': 'totpReset',
  'password-reset': 'passwordReset',
} as const;

const ERROR_KEYS = {
  invalid: 'invalid',
  denied: 'denied',
} as const;

const buttonClass = 'rounded border border-gray-400 px-2 py-1 text-xs';

export default async function MaintainersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const t = await getTranslations('admin');
  const { status, error } = await searchParams;
  const { accounts, currentUserId } = await listAccounts();
  const messageKey = status ? STATUS_KEYS[status as keyof typeof STATUS_KEYS] : undefined;
  const errorKey = error ? ERROR_KEYS[error as keyof typeof ERROR_KEYS] : undefined;
  const message = messageKey ? t(`maintainers.messages.${messageKey}`) : undefined;
  const errorMessage = errorKey ? t(`maintainers.errors.${errorKey}`) : undefined;
  const roleLabels = {
    ADMIN: t('maintainers.roles.ADMIN'),
    MAINTAINER: t('maintainers.roles.MAINTAINER'),
  } as const;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <Link className="text-sm underline" href="/">{t('maintainers.back')}</Link>
      <h1 className="mt-5 text-3xl font-semibold">{t('maintainers.title')}</h1>
      {message && <p className="mt-4 rounded bg-green-50 p-3 text-sm text-green-900" role="status">{message}</p>}
      {errorMessage && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800" role="alert">{errorMessage}</p>}

      <section className="mt-8">
        <h2 className="text-xl font-medium">{t('maintainers.create.title')}</h2>
        <form action={createMaintainerAction} className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t('maintainers.create.name')}</span>
            <input className="w-full rounded border border-gray-300 px-3 py-2" maxLength={200} name="name" required />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t('maintainers.create.email')}</span>
            <input className="w-full rounded border border-gray-300 px-3 py-2" maxLength={254} name="email" required type="email" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t('maintainers.create.password')}</span>
            <input
              autoComplete="new-password"
              className="w-full rounded border border-gray-300 px-3 py-2"
              maxLength={MAX_PASSWORD_LENGTH}
              minLength={MIN_PASSWORD_LENGTH}
              name="password"
              required
              type="password"
            />
          </label>
          <button className="rounded bg-black px-4 py-2 text-white sm:col-span-3 sm:w-fit" type="submit">
            {t('maintainers.create.submit')}
          </button>
        </form>
      </section>

      <section className="mt-10 overflow-x-auto">
        <h2 className="text-xl font-medium">{t('maintainers.accounts.title')}</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="py-2 pr-3">{t('maintainers.accounts.columns.account')}</th>
              <th className="py-2 pr-3">{t('maintainers.accounts.columns.roles')}</th>
              <th className="py-2 pr-3">{t('maintainers.accounts.columns.status')}</th>
              <th className="py-2">{t('maintainers.accounts.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const isSelf = account.id === currentUserId;
              return (
                <tr className="border-b border-gray-200 align-top" key={account.id}>
                  <td className="py-3 pr-3">
                    <div className="font-medium">{account.name}</div>
                    <div className="text-gray-600">{account.email}</div>
                  </td>
                  <td className="py-3 pr-3">
                    {account.roles.map((role) => roleLabels[role as keyof typeof roleLabels] ?? role).join(', ')}
                  </td>
                  <td className="py-3 pr-3">
                    {account.disabled ? t('maintainers.accounts.status.disabled') : t('maintainers.accounts.status.active')}
                    <div className="text-gray-600">
                      {account.twoFactorEnabled ? t('maintainers.accounts.mfa.enrolled') : t('maintainers.accounts.mfa.pending')}
                    </div>
                  </td>
                  <td className="py-3">
                    {account.roles.includes('ADMIN') && !account.roles.includes('MAINTAINER') && (
                      <form action={grantMaintainerRoleAction} className="mb-2">
                        <input name="userId" type="hidden" value={account.id} />
                        <button className={buttonClass} type="submit">{t('maintainers.accounts.actions.grantMaintainer')}</button>
                      </form>
                    )}
                    {isSelf ? (
                      <span className="text-gray-600">{t('maintainers.accounts.actions.self')}</span>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                          <form action={setDisabledAction}>
                            <input name="userId" type="hidden" value={account.id} />
                            <input name="disable" type="hidden" value={String(!account.disabled)} />
                            <button className={buttonClass} type="submit">
                              {account.disabled ? t('maintainers.accounts.actions.enable') : t('maintainers.accounts.actions.disable')}
                            </button>
                          </form>
                          <form action={revokeSessionsAction}>
                            <input name="userId" type="hidden" value={account.id} />
                            <button className={buttonClass} type="submit">{t('maintainers.accounts.actions.revokeSessions')}</button>
                          </form>
                          <form action={resetTotpAction}>
                            <input name="userId" type="hidden" value={account.id} />
                            <button className={buttonClass} type="submit">{t('maintainers.accounts.actions.resetAuthenticator')}</button>
                          </form>
                        </div>
                        <form action={resetPasswordAction} className="flex gap-2">
                          <input name="userId" type="hidden" value={account.id} />
                          <input
                            aria-label={t('maintainers.accounts.actions.newPasswordAria', { email: account.email })}
                            autoComplete="new-password"
                            className="rounded border border-gray-300 px-2 py-1 text-xs"
                            maxLength={MAX_PASSWORD_LENGTH}
                            minLength={MIN_PASSWORD_LENGTH}
                            name="newPassword"
                            placeholder={t('maintainers.accounts.actions.newPasswordPlaceholder')}
                            required
                            type="password"
                          />
                          <button className={buttonClass} type="submit">{t('maintainers.accounts.actions.resetPassword')}</button>
                        </form>
                        {account.roles.includes('ADMIN') && account.roles.includes('MAINTAINER') && (
                          <form action={revokeMaintainerRoleAction}>
                            <input name="userId" type="hidden" value={account.id} />
                            <button className={buttonClass} type="submit">{t('maintainers.accounts.actions.revokeMaintainer')}</button>
                          </form>
                        )}
                        {account.roles.includes('MAINTAINER') && !account.roles.includes('ADMIN') && !account.disabled && (
                          <form action={grantAdminRoleAction}>
                            <input name="userId" type="hidden" value={account.id} />
                            <button className={buttonClass} type="submit">{t('maintainers.accounts.actions.grantAdmin')}</button>
                          </form>
                        )}
                        {account.roles.includes('ADMIN') && account.roles.includes('MAINTAINER') && (
                          <form action={revokeAdminRoleAction}>
                            <input name="userId" type="hidden" value={account.id} />
                            <button className={buttonClass} type="submit">{t('maintainers.accounts.actions.revokeAdmin')}</button>
                          </form>
                        )}
                        {account.roles.includes('MAINTAINER') && !account.roles.includes('ADMIN') && (
                          <details>
                            <summary className="cursor-pointer text-xs text-red-800">{t('maintainers.accounts.actions.deleteSummary')}</summary>
                            <form action={deleteMaintainerAction} className="mt-2">
                              <input name="userId" type="hidden" value={account.id} />
                              <button className="rounded border border-red-700 px-2 py-1 text-xs text-red-800" type="submit">
                                {t('maintainers.accounts.actions.deleteButton', { email: account.email })}
                              </button>
                            </form>
                          </details>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
