export class RecordNotFoundError extends Error {
  constructor() {
    super('The requested record no longer exists.');
    this.name = 'RecordNotFoundError';
  }
}

export class InvalidCursorError extends Error {
  constructor() {
    super('The result cursor is no longer valid.');
    this.name = 'InvalidCursorError';
  }
}

export class InvalidOrganizationError extends Error {
  constructor() {
    super('The selected organization is not available.');
    this.name = 'InvalidOrganizationError';
  }
}

export class DuplicateOrganizationError extends Error {
  constructor() {
    super('An organization with this name already exists.');
    this.name = 'DuplicateOrganizationError';
  }
}

export class DuplicateMasterDataError extends Error {
  constructor() {
    super('A record with this name already exists.');
    this.name = 'DuplicateMasterDataError';
  }
}

export class InvalidAssignmentError extends Error {
  constructor() {
    super('The selected record cannot be assigned in its current state.');
    this.name = 'InvalidAssignmentError';
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor() {
    super('The requested status change is not allowed.');
    this.name = 'InvalidStatusTransitionError';
  }
}

export class DuplicateQualificationAssignmentError extends Error {
  constructor() {
    super('This qualification is already assigned to the helper.');
    this.name = 'DuplicateQualificationAssignmentError';
  }
}
