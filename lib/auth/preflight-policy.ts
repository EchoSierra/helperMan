export function retentionPolicyBlockers(source: Record<string, string | undefined>): string[] {
  const failures: string[] = [];
  if (source.HELPER_RETENTION_POLICY_APPROVED !== 'true') {
    failures.push('The inactive-helper retention policy has not been approved.');
  }
  if (source.AUDIT_RETENTION_POLICY_APPROVED !== 'true') {
    failures.push('The audit-log retention schedule has not been approved.');
  }
  return failures;
}
