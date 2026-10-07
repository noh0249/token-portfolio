// Only deliberate user-facing errors may be returned to a browser.
export class PublicError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
