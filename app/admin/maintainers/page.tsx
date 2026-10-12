import Link from 'next/link';
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

const MESSAGES: Record<string, string> = {
  'role-granted': 'Maintainer role granted. The user needs no new sign-in.',
  'role-revoked': 'Maintainer role revoked and sessions revoked.',
  'admin-granted': 'Administrator role granted. The user needs no new sign-in.',
  'admin-revoked': 'Administrator role revoked and sessions revoked.',
  deleted: 'Maintainer account deleted.',
  created: 'Maintainer created. Share the initial password through a separate secure channel.',
  disabled: 'Account disabled and its sessions revoked.',
  enabled: 'Account enabled.',
  'sessions-revoked': 'Sessions revoked.',
  'totp-reset': 'Authenticator reset. The user must enroll again at next sign-in.',
  'password-reset': 'Password reset and sessions revoked.',
};

const ERRORS: Record<string, string> = {
  invalid: 'The input was not valid. Check the fields and try again.',
  denied: 'That action is not permitted for this account.',
};

const buttonClass = 'rounded border border-gray-400 px-2 py-1 text-xs';

export default async function MaintainersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { status, error } = await searchParams;
  const { accounts, currentUserId } = await listAccounts();
  const message = status ? MESSAGES[status] : undefined;
  const errorMessage = error ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <Link className="text-sm underline" href="/">Back</Link>
      <h1 className="mt-5 text-3xl font-semibold">Account management</h1>
      {message && <p className="mt-4 rounded bg-green-50 p-3 text-sm text-green-900" role="status">{message}</p>}
      {errorMessage && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800" role="alert">{errorMessage}</p>}

      <section className="mt-8">
        <h2 className="text-xl font-medium">Create Maintainer</h2>
        <form action={createMaintainerAction} className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Name</span>
            <input className="w-full rounded border border-gray-300 px-3 py-2" maxLength={200} name="name" required />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Email</span>
            <input className="w-full rounded border border-gray-300 px-3 py-2" maxLength={254} name="email" required type="email" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Initial password</span>
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
            Create Maintainer
          </button>
        </form>
      </section>

      <section className="mt-10 overflow-x-auto">
        <h2 className="text-xl font-medium">Accounts</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="py-2 pr-3">Account</th>
              <th className="py-2 pr-3">Roles</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2">Actions</th>
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
                  <td className="py-3 pr-3">{account.roles.join(', ')}</td>
                  <td className="py-3 pr-3">
                    {account.disabled ? 'Disabled' : 'Active'}
                    <div className="text-gray-600">{account.twoFactorEnabled ? 'Authenticator enrolled' : 'Authenticator pending'}</div>
                  </td>
                  <td className="py-3">
                    {account.roles.includes('ADMIN') && !account.roles.includes('MAINTAINER') && (
                      <form action={grantMaintainerRoleAction} className="mb-2">
                        <input name="userId" type="hidden" value={account.id} />
                        <button className={buttonClass} type="submit">Grant Maintainer role</button>
                      </form>
                    )}
                    {isSelf ? (
                      <span className="text-gray-600">This is you</span>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                          <form action={setDisabledAction}>
                            <input name="userId" type="hidden" value={account.id} />
                            <input name="disable" type="hidden" value={String(!account.disabled)} />
                            <button className={buttonClass} type="submit">{account.disabled ? 'Enable' : 'Disable'}</button>
                          </form>
                          <form action={revokeSessionsAction}>
                            <input name="userId" type="hidden" value={account.id} />
                            <button className={buttonClass} type="submit">Revoke sessions</button>
                          </form>
                          <form action={resetTotpAction}>
                            <input name="userId" type="hidden" value={account.id} />
                            <button className={buttonClass} type="submit">Reset authenticator</button>
                          </form>
                        </div>
                        <form action={resetPasswordAction} className="flex gap-2">
                          <input name="userId" type="hidden" value={account.id} />
                          <input
                            aria-label={`New password for ${account.email}`}
                            autoComplete="new-password"
                            className="rounded border border-gray-300 px-2 py-1 text-xs"
                            maxLength={MAX_PASSWORD_LENGTH}
                            minLength={MIN_PASSWORD_LENGTH}
                            name="newPassword"
                            placeholder="New password"
                            required
                            type="password"
                          />
                          <button className={buttonClass} type="submit">Reset password</button>
                        </form>
                        {account.roles.includes('ADMIN') && account.roles.includes('MAINTAINER') && (
                          <form action={revokeMaintainerRoleAction}>
                            <input name="userId" type="hidden" value={account.id} />
                            <button className={buttonClass} type="submit">Revoke Maintainer role</button>
                          </form>
                        )}
                        {account.roles.includes('MAINTAINER') && !account.roles.includes('ADMIN') && !account.disabled && (
                          <form action={grantAdminRoleAction}>
                            <input name="userId" type="hidden" value={account.id} />
                            <button className={buttonClass} type="submit">Make Administrator</button>
                          </form>
                        )}
                        {account.roles.includes('ADMIN') && account.roles.includes('MAINTAINER') && (
                          <form action={revokeAdminRoleAction}>
                            <input name="userId" type="hidden" value={account.id} />
                            <button className={buttonClass} type="submit">Revoke Administrator role</button>
                          </form>
                        )}
                        {account.roles.includes('MAINTAINER') && !account.roles.includes('ADMIN') && (
                          <details>
                            <summary className="cursor-pointer text-xs text-red-800">Delete account…</summary>
                            <form action={deleteMaintainerAction} className="mt-2">
                              <input name="userId" type="hidden" value={account.id} />
                              <button className="rounded border border-red-700 px-2 py-1 text-xs text-red-800" type="submit">
                                Permanently delete {account.email}
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
