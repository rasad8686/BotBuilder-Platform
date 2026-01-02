# BotBuilder SDK for Go

Official Go SDK for the BotBuilder API.

## Installation

```bash
go get github.com/botbuilder/sdk-go
```

## Quick Start

```go
package main

import (
    "fmt"
    botbuilder "github.com/botbuilder/sdk-go"
)

func main() {
    client, err := botbuilder.NewClient(&botbuilder.Config{
        APIKey: "your-api-key",
    })
    if err != nil {
        panic(err)
    }

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
        Message: "Hello!",
    })
    if err != nil {
        panic(err)
    }

    fmt.Println(response)
}
```

## Configuration

```go
client, err := botbuilder.NewClient(&botbuilder.Config{
    APIKey:  "your-api-key",              // Required
    BaseURL: "https://api.botbuilder.com", // Optional
    Timeout: 30 * time.Second,            // Optional
})
```

## Requirements

- Go 1.18 or higher

## License

MIT
