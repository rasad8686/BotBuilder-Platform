# BotBuilder SDK for Ruby

Official Ruby SDK for the BotBuilder API.

## Installation

```bash
gem install botbuilder-sdk
```

Or add to your Gemfile:

```ruby
gem 'botbuilder-sdk'
```

## Quick Start

```ruby
require 'botbuilder'

client = BotBuilder::Client.new(api_key: 'your-api-key')

# Create a bot
bot = client.bots.create(
  name: 'My Bot',
  description: 'A helpful assistant'
)

# Send a message
response = client.messages.send(
  bot_id: bot['id'],
  message: 'Hello!'
)

puts response
```

## Configuration

```ruby
client = BotBuilder::Client.new(
  api_key: 'your-api-key',  # Required
  base_url: 'https://api.botbuilder.com',  # Optional
  timeout: 30  # Optional (seconds)
)
```

## Requirements

- Ruby 2.7 or higher
- Faraday gem

## License

MIT
