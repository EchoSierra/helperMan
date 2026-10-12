export type FormActionState = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
  helperId?: string;
  successToken?: number;
};

export type HelperDirectoryActionState = {
  search: string;
  items: Array<{ id: string; firstName: string; lastName: string; active: boolean }>;
  nextCursor: string | null;
  message?: string;
};

export type QualificationExpiryActionState = {
  today: string;
  through: string;
  items: Array<{
    helperId: string;
    helperName: string;
    helperActive: boolean;
    qualificationTitle: string;
    validThrough: string;
    status: 'Expired' | 'Expiring';
  }>;
  nextCursor: string | null;
  message?: string;
};
