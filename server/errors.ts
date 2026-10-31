export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details: unknown = null,
  ) {
    super(message);
  }
}
export function demand(value: unknown, code: string, message: string, status = 400): asserts value {
  if (!value) throw new AppError(code, message, status);
}
