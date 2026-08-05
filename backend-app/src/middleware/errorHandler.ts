import type { NextFunction, Request, Response } from 'express';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status =
    typeof err === 'object' && err && 'status' in err && typeof (err as { status: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 500;
  const message = err instanceof Error ? err.message : 'Internal server error';
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({ error: message });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}
