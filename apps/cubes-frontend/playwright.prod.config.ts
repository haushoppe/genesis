import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Override of the local playwright.config that points the suite at
// production (cubes.haushoppe.art) instead of a local `ng serve`.
// Use after a CI deploy to confirm the live build still passes the
// same smoke tests.
export default defineConfig({
  ...base,
  webServer: undefined,
  use: {
    ...base.use,
    baseURL: 'https://cubes.haushoppe.art',
  },
});
