<?php

namespace BotBuilder;

use GuzzleHttp\Client as HttpClient;
use GuzzleHttp\Exception\GuzzleException;

/**
 * BotBuilder SDK for PHP
 * Official SDK for interacting with the BotBuilder API
 */
class Client
{
    private string $apiKey;
    private string $baseUrl;
    private int $timeout;
    private HttpClient $httpClient;

    public Bots $bots;
    public Messages $messages;
    public Knowledge $knowledge;
    public Analytics $analytics;
    public Webhooks $webhooks;

    public function __construct(array $config = [])
    {
        $this->apiKey = $config['apiKey'] ?? getenv('BOTBUILDER_API_KEY');
        $this->baseUrl = rtrim($config['baseUrl'] ?? 'https://api.botbuilder.com', '/');
        $this->timeout = $config['timeout'] ?? 30;

        if (empty($this->apiKey)) {
            throw new \InvalidArgumentException(
                'API key is required. Set it via config["apiKey"] or BOTBUILDER_API_KEY env variable.'
            );
        }

        $this->httpClient = new HttpClient([
            'base_uri' => $this->baseUrl,
            'timeout' => $this->timeout,
            'headers' => [
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
                'User-Agent' => 'BotBuilder-SDK-PHP/1.0.0'
            ]
        ]);

        // Initialize resource clients
        $this->bots = new Bots($this);
        $this->messages = new Messages($this);
        $this->knowledge = new Knowledge($this);
        $this->analytics = new Analytics($this);
        $this->webhooks = new Webhooks($this);
    }

    public function request(string $method, string $endpoint, array $options = []): array
    {
        try {
            $response = $this->httpClient->request($method, $endpoint, $options);
            return json_decode($response->getBody()->getContents(), true);
        } catch (GuzzleException $e) {
            throw new \RuntimeException('API request failed: ' . $e->getMessage(), $e->getCode(), $e);
        }
    }
}

class Bots
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    public function list(array $params = []): array
    {
        return $this->client->request('GET', '/api/bots', ['query' => $params]);
    }

    public function get(string $botId): array
    {
        return $this->client->request('GET', "/api/bots/{$botId}");
    }

    public function create(array $data): array
    {
        return $this->client->request('POST', '/api/bots', ['json' => $data]);
    }

    public function update(string $botId, array $data): array
    {
        return $this->client->request('PUT', "/api/bots/{$botId}", ['json' => $data]);
    }

    public function delete(string $botId): array
    {
        return $this->client->request('DELETE', "/api/bots/{$botId}");
    }
}

class Messages
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    public function send(array $data): array
    {
        return $this->client->request('POST', '/api/messages', ['json' => $data]);
    }

    public function list(string $botId, array $params = []): array
    {
        return $this->client->request('GET', "/api/bots/{$botId}/messages", ['query' => $params]);
    }

    public function get(string $messageId): array
    {
        return $this->client->request('GET', "/api/messages/{$messageId}");
    }
}

class Knowledge
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    public function list(array $params = []): array
    {
        return $this->client->request('GET', '/api/knowledge', ['query' => $params]);
    }

    public function upload($file, array $metadata = []): array
    {
        return $this->client->request('POST', '/api/knowledge/upload', [
            'multipart' => array_merge(
                [['name' => 'file', 'contents' => $file]],
                array_map(fn($k, $v) => ['name' => $k, 'contents' => $v], array_keys($metadata), $metadata)
            )
        ]);
    }

    public function delete(string $documentId): array
    {
        return $this->client->request('DELETE', "/api/knowledge/{$documentId}");
    }
}

class Analytics
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    public function getOverview(array $params = []): array
    {
        return $this->client->request('GET', '/api/analytics/overview', ['query' => $params]);
    }

    public function getMessages(array $params = []): array
    {
        return $this->client->request('GET', '/api/analytics/messages', ['query' => $params]);
    }

    public function getUsers(array $params = []): array
    {
        return $this->client->request('GET', '/api/analytics/users', ['query' => $params]);
    }
}

class Webhooks
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    public function list(): array
    {
        return $this->client->request('GET', '/api/webhooks');
    }

    public function create(array $data): array
    {
        return $this->client->request('POST', '/api/webhooks', ['json' => $data]);
    }

    public function update(string $webhookId, array $data): array
    {
        return $this->client->request('PUT', "/api/webhooks/{$webhookId}", ['json' => $data]);
    }

    public function delete(string $webhookId): array
    {
        return $this->client->request('DELETE', "/api/webhooks/{$webhookId}");
    }
}
