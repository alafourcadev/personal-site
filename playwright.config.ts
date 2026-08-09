import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4321',
    // Playwright's own default is 1280x720. The layout defects this suite
    // exists to catch lived at 1440x900 (the canvas going to `display: none`
    // the moment the player pressed "Probar respuesta"), and a suite that
    // never opens that window cannot see them. Specs that care about a
    // specific width still set their own viewport; this is what everything
    // else is measured against.
    viewport: { width: 1440, height: 900 },
  },
})
