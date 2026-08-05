import express from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { config } from './config.js';
import { router } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ensureSeedUser } from './store/memoryStore.js';

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json());

  app.use(config.apiPrefix, router);

  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: err.flatten(),
      });
      return;
    }
    errorHandler(err, req, res, next);
  });

  return app;
}

export async function boot(): Promise<void> {
  await ensureSeedUser();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(
      `[backend-app] listening on http://localhost:${config.port}${config.apiPrefix} (timeScale=${config.simulationTimeScale})`,
    );
  });
}
