# BotBuilder SDK for Ruby
# Official SDK for interacting with the BotBuilder API

require 'faraday'
require 'json'

module BotBuilder
  VERSION = '1.0.0'

  class Client
    attr_reader :bots, :messages, :knowledge, :analytics, :webhooks

    def initialize(api_key: nil, base_url: 'https://api.botbuilder.com', timeout: 30)
      @api_key = api_key || ENV['BOTBUILDER_API_KEY']
      @base_url = base_url.chomp('/')
      @timeout = timeout

      raise ArgumentError, 'API key is required' if @api_key.nil? || @api_key.empty?

      @connection = Faraday.new(url: @base_url) do |faraday|
        faraday.request :json
        faraday.response :json
        faraday.adapter Faraday.default_adapter
        faraday.headers['Authorization'] = "Bearer #{@api_key}"
        faraday.headers['Content-Type'] = 'application/json'
        faraday.headers['User-Agent'] = "BotBuilder-SDK-Ruby/#{VERSION}"
        faraday.options.timeout = @timeout
      end

      @bots = Bots.new(self)
      @messages = Messages.new(self)
      @knowledge = Knowledge.new(self)
      @analytics = Analytics.new(self)
      @webhooks = Webhooks.new(self)
    end

    def request(method, endpoint, params: {}, body: nil)
      response = @connection.send(method, endpoint) do |req|
        req.params = params unless params.empty?
        req.body = body.to_json if body
      end

      response.body
    end
  end

  class Bots
    def initialize(client)
      @client = client
    end

    def list(**params)
      @client.request(:get, '/api/bots', params: params)
    end

    def get(bot_id)
      @client.request(:get, "/api/bots/#{bot_id}")
    end

    def create(**data)
      @client.request(:post, '/api/bots', body: data)
    end

    def update(bot_id, **data)
      @client.request(:put, "/api/bots/#{bot_id}", body: data)
    end

    def delete(bot_id)
      @client.request(:delete, "/api/bots/#{bot_id}")
    end
  end

  class Messages
    def initialize(client)
      @client = client
    end

    def send(**data)
      @client.request(:post, '/api/messages', body: data)
    end

    def list(bot_id, **params)
      @client.request(:get, "/api/bots/#{bot_id}/messages", params: params)
    end

    def get(message_id)
      @client.request(:get, "/api/messages/#{message_id}")
    end
  end

  class Knowledge
    def initialize(client)
      @client = client
    end

    def list(**params)
      @client.request(:get, '/api/knowledge', params: params)
    end

    def delete(document_id)
      @client.request(:delete, "/api/knowledge/#{document_id}")
    end
  end

  class Analytics
    def initialize(client)
      @client = client
    end

    def overview(**params)
      @client.request(:get, '/api/analytics/overview', params: params)
    end

    def messages(**params)
      @client.request(:get, '/api/analytics/messages', params: params)
    end

    def users(**params)
      @client.request(:get, '/api/analytics/users', params: params)
    end
  end

  class Webhooks
    def initialize(client)
      @client = client
    end

    def list
      @client.request(:get, '/api/webhooks')
    end

    def create(**data)
      @client.request(:post, '/api/webhooks', body: data)
    end

    def update(webhook_id, **data)
      @client.request(:put, "/api/webhooks/#{webhook_id}", body: data)
    end

    def delete(webhook_id)
      @client.request(:delete, "/api/webhooks/#{webhook_id}")
    end
  end
end
