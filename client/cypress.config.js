/**
 * Cypress Configuration for BotBuilder Platform
 * E2E Testing Configuration
 */

import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    // Base URL for the application
    baseUrl: 'http://localhost:5174',

    // Spec file patterns
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',

    // Support file
    supportFile: 'cypress/support/e2e.js',

    // Viewport settings
    viewportWidth: 1280,
    viewportHeight: 720,

    // Timeouts
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 30000,
    pageLoadTimeout: 60000,

    // Video and screenshots
    video: true,
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',

    // Retry configuration
    retries: {
      runMode: 2,
      openMode: 0
    },

    // Environment variables
    env: {
      API_URL: 'http://localhost:5000/api',
      TEST_USER_EMAIL: 'test@example.com',
      TEST_USER_PASSWORD: 'TestPassword123!'
    },

    setupNodeEvents(on, config) {
      // Implement node event listeners here
      on('task', {
        log(message) {
          console.log(message);
          return null;
        }
      });

      return config;
    }
  },

  // Component testing (optional)
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite'
    }
  }
});
