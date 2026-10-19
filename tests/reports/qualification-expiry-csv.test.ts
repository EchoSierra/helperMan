import { describe, expect, it } from 'vitest';
import { qualificationExpiryCsv } from '@/features/reports/qualification-expiry-csv';

const labels = {
  headers: {
    helper: 'Helper',
    helperReference: 'Helper reference',
    qualification: 'Qualification',
    validThrough: 'Valid through',
    status: 'Status',
  },
  inactiveLabel: 'Inactive',
  statusLabels: {
    Expired: 'Expired',
    Expiring: 'Expiring',
  },
} as const;

describe('qualification expiry CSV', () => {
  it('writes UTF-8 spreadsheet CSV with proper quoting and inactive-helper marking', () => {
    const csv = qualificationExpiryCsv([{
      helperId: 'helper-1',
      helperName: 'Ada "Ace", Lovelace',
      helperActive: false,
      qualificationTitle: 'First aid\r\nLevel 2',
      validThrough: '2026-11-01',
      status: 'Expiring',
    }], labels);

    expect(csv).toBe(
      '\uFEFF"Helper","Helper reference","Qualification","Valid through","Status"\r\n' +
      '"Ada ""Ace"", Lovelace (Inactive)","helper-1","First aid\r\nLevel 2","2026-11-01","Expiring"\r\n',
    );
  });

  it.each(['=1+1', '+SUM(A1:A2)', '-2+3', '@SUM(A1:A2)', '\t=1+1', ' \r\n@SUM(A1:A2)'])(
    'neutralizes spreadsheet formula input %j',
    (title) => {
      const csv = qualificationExpiryCsv([{
        helperId: 'helper-1',
        helperName: 'Ada Lovelace',
        helperActive: true,
        qualificationTitle: title,
        validThrough: '2026-11-01',
        status: 'Expiring',
      }], labels);

      expect(csv).toContain(`,"'${title.replaceAll('"', '""')}",`);
    },
  );
});
