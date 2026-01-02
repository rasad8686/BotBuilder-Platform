/**
 * SDK Generator Service
 * Generates SDKs from OpenAPI spec for multiple languages
 * Uses pre-built templates and openapi-generator-cli
 */

const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const log = require('../utils/logger');

const execAsync = promisify(exec);

// Supported SDK languages
const SUPPORTED_LANGUAGES = {
  javascript: {
    name: 'JavaScript',
    generator: 'javascript',
    packageManager: 'npm',
    installCommand: 'npm install botbuilder-sdk',
    fileExtension: '.js',
    icon: 'js'
  },
  python: {
    name: 'Python',
    generator: 'python',
    packageManager: 'pip',
    installCommand: 'pip install botbuilder-sdk',
    fileExtension: '.py',
    icon: 'python'
  },
  php: {
    name: 'PHP',
    generator: 'php',
    packageManager: 'composer',
    installCommand: 'composer require botbuilder/sdk',
    fileExtension: '.php',
    icon: 'php'
  },
  go: {
    name: 'Go',
    generator: 'go',
    packageManager: 'go',
    installCommand: 'go get github.com/botbuilder/sdk-go',
    fileExtension: '.go',
    icon: 'go'
  },
  ruby: {
    name: 'Ruby',
    generator: 'ruby',
    packageManager: 'gem',
    installCommand: 'gem install botbuilder-sdk',
    fileExtension: '.rb',
    icon: 'ruby'
  }
};

// SDK download tokens storage (in-memory, should use Redis in production)
const downloadTokens = new Map();

// Clean up expired tokens every hour
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of downloadTokens.entries()) {
    if (data.expiresAt < now) {
      downloadTokens.delete(token);
      // Clean up temp file if exists
      if (data.filePath) {
        fs.unlink(data.filePath).catch(() => {});
      }
    }
  }
}, 60 * 60 * 1000);

/**
 * Get list of supported SDK languages
 */
const getSupportedLanguages = () => {
  return Object.entries(SUPPORTED_LANGUAGES).map(([key, value]) => ({
    id: key,
    name: value.name,
    packageManager: value.packageManager,
    installCommand: value.installCommand,
    icon: value.icon
  }));
};

/**
 * Generate SDK for a specific language
 * @param {string} language - Target language (javascript, python, etc.)
 * @param {object} options - Generation options
 * @returns {object} - Download token and expiry
 */
const generateSDK = async (language, options = {}) => {
  if (!SUPPORTED_LANGUAGES[language]) {
    throw new Error(`Unsupported language: ${language}. Supported: ${Object.keys(SUPPORTED_LANGUAGES).join(', ')}`);
  }

  const langConfig = SUPPORTED_LANGUAGES[language];
  const templateDir = path.join(__dirname, '..', 'sdk-templates', language);
  const tempDir = path.join(__dirname, '..', '..', 'temp', 'sdk-builds');
  const buildId = crypto.randomBytes(8).toString('hex');
  const buildDir = path.join(tempDir, buildId);

  try {
    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(buildDir, { recursive: true });

    // Check if template exists
    try {
      await fs.access(templateDir);
    } catch {
      throw new Error(`SDK template not found for ${language}`);
    }

    // Copy template to build directory
    await copyDir(templateDir, buildDir);

    // Create zip file
    const zipFileName = `botbuilder-sdk-${language}-${buildId}.zip`;
    const zipFilePath = path.join(tempDir, zipFileName);

    // Use native zip on Windows or tar on Unix
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      // Use PowerShell to create zip
      await execAsync(`powershell -Command "Compress-Archive -Path '${buildDir}\\*' -DestinationPath '${zipFilePath}'"`, {
        timeout: 30000
      });
    } else {
      await execAsync(`cd "${buildDir}" && zip -r "${zipFilePath}" .`, {
        timeout: 30000
      });
    }

    // Generate download token
    const downloadToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Store token
    downloadTokens.set(downloadToken, {
      filePath: zipFilePath,
      fileName: zipFileName,
      language,
      expiresAt,
      createdAt: Date.now()
    });

    // Clean up build directory
    await fs.rm(buildDir, { recursive: true, force: true });

    log.info('[SDK_GENERATOR] SDK generated', {
      language,
      buildId,
      downloadToken: downloadToken.substring(0, 8) + '...'
    });

    return {
      downloadToken,
      downloadUrl: `/api/sdk/download/${downloadToken}`,
      fileName: zipFileName,
      language: langConfig.name,
      expiresAt: new Date(expiresAt).toISOString()
    };
  } catch (error) {
    // Clean up on error
    await fs.rm(buildDir, { recursive: true, force: true }).catch(() => {});
    log.error('[SDK_GENERATOR] SDK generation failed', {
      language,
      error: error.message
    });
    throw error;
  }
};

/**
 * Get SDK file by download token
 * @param {string} token - Download token
 * @returns {object} - File path and name
 */
const getSDKByToken = async (token) => {
  const data = downloadTokens.get(token);

  if (!data) {
    throw new Error('Invalid or expired download token');
  }

  if (data.expiresAt < Date.now()) {
    downloadTokens.delete(token);
    throw new Error('Download token has expired');
  }

  // Check if file exists
  try {
    await fs.access(data.filePath);
  } catch {
    downloadTokens.delete(token);
    throw new Error('SDK file not found');
  }

  return {
    filePath: data.filePath,
    fileName: data.fileName,
    language: data.language
  };
};

/**
 * Copy directory recursively
 */
const copyDir = async (src, dest) => {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
};

/**
 * Get quick start code example for a language
 */
const getQuickStartExample = (language) => {
  const examples = {
    javascript: `const BotBuilder = require('botbuilder-sdk');

const client = new BotBuilder({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.botbuilder.com'
});

// Create a bot
const bot = await client.bots.create({
  name: 'My Bot',
  description: 'A helpful assistant'
});

// Send a message
const response = await client.messages.send({
  botId: bot.id,
  message: 'Hello, world!'
});

console.log(response);`,

    python: `from botbuilder import BotBuilder

client = BotBuilder(
    api_key='your-api-key',
    base_url='https://api.botbuilder.com'
)

# Create a bot
bot = client.bots.create(
    name='My Bot',
    description='A helpful assistant'
)

# Send a message
response = client.messages.send(
    bot_id=bot.id,
    message='Hello, world!'
)

print(response)`,

    php: `<?php
require 'vendor/autoload.php';

use BotBuilder\\Client;

$client = new Client([
    'apiKey' => 'your-api-key',
    'baseUrl' => 'https://api.botbuilder.com'
]);

// Create a bot
$bot = $client->bots->create([
    'name' => 'My Bot',
    'description' => 'A helpful assistant'
]);

// Send a message
$response = $client->messages->send([
    'botId' => $bot->id,
    'message' => 'Hello, world!'
]);

print_r($response);`,

    go: `package main

import (
    "fmt"
    botbuilder "github.com/botbuilder/sdk-go"
)

func main() {
    client := botbuilder.NewClient(&botbuilder.Config{
        APIKey:  "your-api-key",
        BaseURL: "https://api.botbuilder.com",
    })

    // Create a bot
    bot, err := client.Bots.Create(&botbuilder.CreateBotRequest{
        Name:        "My Bot",
        Description: "A helpful assistant",
    })
    if err != nil {
        panic(err)
    }

    // Send a message
    response, err := client.Messages.Send(&botbuilder.SendMessageRequest{
        BotID:   bot.ID,
        Message: "Hello, world!",
    })
    if err != nil {
        panic(err)
    }

    fmt.Println(response)
}`,

    ruby: `require 'botbuilder'

client = BotBuilder::Client.new(
  api_key: 'your-api-key',
  base_url: 'https://api.botbuilder.com'
)

# Create a bot
bot = client.bots.create(
  name: 'My Bot',
  description: 'A helpful assistant'
)

# Send a message
response = client.messages.send(
  bot_id: bot.id,
  message: 'Hello, world!'
)

puts response`
  };

  return examples[language] || '';
};

module.exports = {
  getSupportedLanguages,
  generateSDK,
  getSDKByToken,
  getQuickStartExample,
  SUPPORTED_LANGUAGES
};
