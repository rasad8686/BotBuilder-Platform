// Package botbuilder provides the official BotBuilder SDK for Go
package botbuilder

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/go-resty/resty/v2"
)

// Version is the SDK version
const Version = "1.0.0"

// Config holds the client configuration
type Config struct {
	APIKey  string
	BaseURL string
	Timeout time.Duration
}

// Client is the main BotBuilder API client
type Client struct {
	config     *Config
	httpClient *resty.Client
	Bots       *BotsService
	Messages   *MessagesService
	Knowledge  *KnowledgeService
	Analytics  *AnalyticsService
	Webhooks   *WebhooksService
}

// NewClient creates a new BotBuilder client
func NewClient(config *Config) (*Client, error) {
	if config == nil {
		config = &Config{}
	}

	if config.APIKey == "" {
		config.APIKey = os.Getenv("BOTBUILDER_API_KEY")
	}

	if config.APIKey == "" {
		return nil, fmt.Errorf("API key is required")
	}

	if config.BaseURL == "" {
		config.BaseURL = "https://api.botbuilder.com"
	}

	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}

	httpClient := resty.New().
		SetBaseURL(config.BaseURL).
		SetTimeout(config.Timeout).
		SetHeader("Authorization", "Bearer "+config.APIKey).
		SetHeader("Content-Type", "application/json").
		SetHeader("User-Agent", "BotBuilder-SDK-Go/"+Version)

	c := &Client{
		config:     config,
		httpClient: httpClient,
	}

	c.Bots = &BotsService{client: c}
	c.Messages = &MessagesService{client: c}
	c.Knowledge = &KnowledgeService{client: c}
	c.Analytics = &AnalyticsService{client: c}
	c.Webhooks = &WebhooksService{client: c}

	return c, nil
}

// Bot represents a bot
type Bot struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	CreatedAt   string `json:"created_at"`
}

// Message represents a message
type Message struct {
	ID        string `json:"id"`
	BotID     string `json:"bot_id"`
	Content   string `json:"content"`
	Role      string `json:"role"`
	CreatedAt string `json:"created_at"`
}

// BotsService handles bot operations
type BotsService struct {
	client *Client
}

// List returns all bots
func (s *BotsService) List() ([]Bot, error) {
	resp, err := s.client.httpClient.R().Get("/api/bots")
	if err != nil {
		return nil, err
	}

	var bots []Bot
	if err := json.Unmarshal(resp.Body(), &bots); err != nil {
		return nil, err
	}

	return bots, nil
}

// Get returns a specific bot
func (s *BotsService) Get(botID string) (*Bot, error) {
	resp, err := s.client.httpClient.R().Get("/api/bots/" + botID)
	if err != nil {
		return nil, err
	}

	var bot Bot
	if err := json.Unmarshal(resp.Body(), &bot); err != nil {
		return nil, err
	}

	return &bot, nil
}

// CreateBotRequest is the request for creating a bot
type CreateBotRequest struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

// Create creates a new bot
func (s *BotsService) Create(req *CreateBotRequest) (*Bot, error) {
	resp, err := s.client.httpClient.R().SetBody(req).Post("/api/bots")
	if err != nil {
		return nil, err
	}

	var bot Bot
	if err := json.Unmarshal(resp.Body(), &bot); err != nil {
		return nil, err
	}

	return &bot, nil
}

// Delete deletes a bot
func (s *BotsService) Delete(botID string) error {
	_, err := s.client.httpClient.R().Delete("/api/bots/" + botID)
	return err
}

// MessagesService handles message operations
type MessagesService struct {
	client *Client
}

// SendMessageRequest is the request for sending a message
type SendMessageRequest struct {
	BotID   string `json:"bot_id"`
	Message string `json:"message"`
	UserID  string `json:"user_id,omitempty"`
}

// Send sends a message
func (s *MessagesService) Send(req *SendMessageRequest) (*Message, error) {
	resp, err := s.client.httpClient.R().SetBody(req).Post("/api/messages")
	if err != nil {
		return nil, err
	}

	var msg Message
	if err := json.Unmarshal(resp.Body(), &msg); err != nil {
		return nil, err
	}

	return &msg, nil
}

// List returns messages for a bot
func (s *MessagesService) List(botID string) ([]Message, error) {
	resp, err := s.client.httpClient.R().Get("/api/bots/" + botID + "/messages")
	if err != nil {
		return nil, err
	}

	var messages []Message
	if err := json.Unmarshal(resp.Body(), &messages); err != nil {
		return nil, err
	}

	return messages, nil
}

// KnowledgeService handles knowledge base operations
type KnowledgeService struct {
	client *Client
}

// AnalyticsService handles analytics operations
type AnalyticsService struct {
	client *Client
}

// WebhooksService handles webhook operations
type WebhooksService struct {
	client *Client
}
