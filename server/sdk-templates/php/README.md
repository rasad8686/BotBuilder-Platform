# BotBuilder SDK for PHP

Official PHP SDK for the BotBuilder API.

## Installation

```bash
composer require botbuilder/sdk
```

## Quick Start

```php
<?php
require 'vendor/autoload.php';

use BotBuilder\Client;

$client = new Client(['apiKey' => 'your-api-key']);

// Create a bot
$bot = $client->bots->create([
    'name' => 'My Bot',
    'description' => 'A helpful assistant'
]);

// Send a message
$response = $client->messages->send([
    'botId' => $bot['id'],
    'message' => 'Hello!'
]);
```

## Configuration

```php
$client = new Client([
    'apiKey' => 'your-api-key',  // Required
    'baseUrl' => 'https://api.botbuilder.com',  // Optional
    'timeout' => 30  // Optional (seconds)
]);
```

## Requirements

- PHP 7.4 or higher
- Guzzle HTTP client

## License

MIT
