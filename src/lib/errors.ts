// Standardized error shape per design.md "Error Handling" table.
// Thrown anywhere in a route handler; caught once in src/index.ts's onError.
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, detail?: string) {
    super(detail ?? code);
    this.status = status;
    this.code = code;
  }
}
