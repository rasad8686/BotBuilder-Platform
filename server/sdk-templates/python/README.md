# BotBuilder SDK for Python

Official Python SDK for the BotBuilder API.

## Installation

```bash
pip install botbuilder-sdk
```

## Quick Start

```python
from botbuilder import BotBuilder

client = BotBuilder(api_key='your-api-key')

# Create a bot
bot = client.bots.create(
    name='My Bot',
    description='A helpful assistant'
)

# Send a message
response = client.messages.send(
    bot_id=bot['id'],
    message='Hello!'
)
```

## Configuration

```python
client = BotBuilder(
    api_key='your-api-key',  # Required
    base_url='https://api.botbuilder.com',  # Optional
    timeout=30  # Optional (seconds)
)
```

## Available Resources

- `client.bots` - Bot management
- `client.messages` - Message sending/receiving
- `client.knowledge` - Knowledge base management
- `client.analytics` - Analytics and metrics
- `client.webhooks` - Webhook configuration

## API Reference

### Bots

```python
# List all bots
bots = client.bots.list()

# Get a specific bot
bot = client.bots.get('bot-id')

# Create a bot
new_bot = client.bots.create(name='My Bot')

# Update a bot
client.bots.update('bot-id', name='Updated Name')

# Delete a bot
client.bots.delete('bot-id')
```

### Messages

```python
# Send a message
response = client.messages.send(
    bot_id='bot-id',
    message='Hello!',
    user_id='user-123'
)

# List messages
messages = client.messages.list('bot-id', limit=50, offset=0)
```

### Knowledge Base

```python
# Upload a document
with open('document.pdf', 'rb') as f:
    doc = client.knowledge.upload(f, name='document.pdf', bot_id='bot-id')

# List documents
docs = client.knowledge.list(bot_id='bot-id')

# Delete a document
client.knowledge.delete('doc-id')
```

## Error Handling

```python
from requests.exceptions import HTTPError

try:
    bot = client.bots.get('invalid-id')
except HTTPError as e:
    print(f'API Error: {e.response.status_code} - {e.response.text}')
except Exception as e:
    print(f'Error: {e}')
```

## License

MIT
