import { defineConfig } from '@playwright/test'

// A developer may already be using 4321 to inspect the site. Let verification
// choose an isolated port without stopping or accidentally reusing that
// session; CI keeps the established default.
const previewPort = process.env.PLAYWRIGHT_PORT ?? '4321'
const baseURL = `http://localhost:${previewPort}`

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: `npm run build && npm run preview -- --port ${previewPort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL,
    // Playwright's own default is 1280x720. The layout defects this suite
    // exists to catch lived at 1440x900 (the canvas going to `display: none`
    // the moment the player pressed "Probar respuesta"), and a suite that
    // never opens that window cannot see them. Specs that care about a
    // specific width still set their own viewport; this is what everything
    // else is measured against.
    viewport: { width: 1440, height: 900 },
  },
})
