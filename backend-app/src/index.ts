import { boot } from './app.js';

boot().catch((err) => {
  console.error('Failed to start backend-app', err);
  process.exit(1);
});
