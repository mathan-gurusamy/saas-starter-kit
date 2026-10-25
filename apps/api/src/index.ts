import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

const server = createApp().listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
