const REQUIRED = [
  ['INACTIVE_HELPER', 'The inactive-helper retention schedule has not been approved in /admin/retention.'],
  ['AUDIT_LOG', 'The audit-log retention schedule has not been approved in /admin/retention.'],
] as const;

export function retentionPolicyBlockers(configuredKinds: readonly string[]): string[] {
  return REQUIRED.filter(([kind]) => !configuredKinds.includes(kind)).map(([, message]) => message);
}
