import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/saas_test',
      JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-123456',
      WEB_URL: 'http://localhost:5173',
      STRIPE_PRICE_PRO: 'price_pro_test',
      STRIPE_PRICE_TEAM: 'price_team_test',
    },
  },
});
