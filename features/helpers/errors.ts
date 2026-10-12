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
