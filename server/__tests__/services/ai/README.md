# AI Services Test Suite

Comprehensive test coverage for AI service provider integrations.

## Test Files Overview

### 1. AIProviderFactory.enhanced.test.js (56 tests)
**Enhanced tests for AI Provider Factory**

Tests include:
- Provider creation and instantiation (7 tests)
- Provider validation errors (9 tests)
- Supported providers list (5 tests)
- Model information and metadata (8 tests)
- Model configuration lookup (6 tests)
- Configuration validation (16 tests)
- Provider switching scenarios (2 tests)

**Key Coverage:**
- ✓ OpenAI and Claude provider creation
- ✓ Case-insensitive provider handling
- ✓ Comprehensive validation logic
- ✓ Model metadata and pricing
- ✓ Temperature, token, and context window validation
- ✓ Multi-provider support

### 2. OpenAIProvider.enhanced.test.js (45 tests)
**Enhanced tests for OpenAI API integration**

Tests include:
- Constructor and initialization (6 tests)
- Chat completion success scenarios (8 tests)
- Chat completion finish reasons (3 tests)
- Chat completion error handling (8 tests)
- Input validation (5 tests)
- Streaming chat completion (10 tests)
- Connection testing (5 tests)

**Key Coverage:**
- ✓ API key validation
- ✓ Multi-turn conversations
- ✓ System messages
- ✓ Rate limit errors (429)
- ✓ Authentication errors (401)
- ✓ Server errors (500, 502, 503)
- ✓ Streaming with chunk accumulation
- ✓ Token usage tracking
- ✓ Response time measurement

### 3. AnthropicProvider.enhanced.test.js (52 tests)
**Enhanced tests for Anthropic Claude API integration**

Tests include:
- Constructor and initialization (7 tests)
- Message format conversion (6 tests)
- Chat completion success scenarios (9 tests)
- Chat completion error handling (7 tests)
- Input validation (5 tests)
- Streaming chat completion (10 tests)
- Connection testing (5 tests)

**Key Coverage:**
- ✓ API key trimming and validation
- ✓ OpenAI to Claude message format conversion
- ✓ System message handling
- ✓ Authentication errors with helpful messages
- ✓ Rate limiting (429) and overloaded (529) errors
- ✓ Streaming with event types
- ✓ Token tracking from stream events
- ✓ Multi-turn conversation support

### 4. GeminiProvider.mock.test.js (34 tests)
**Mock tests for hypothetical Gemini provider**

Tests include:
- Constructor and initialization (4 tests)
- Chat completion expected behavior (6 tests)
- Safety settings (3 tests)
- Error handling patterns (5 tests)
- Streaming behavior (3 tests)
- Token counting (2 tests)
- Multimodal support (2 tests)
- Rate limiting and retry logic (3 tests)
- Function calling (3 tests)
- Integration patterns (3 tests)

**Key Coverage:**
- ✓ Gemini API format and response structure
- ✓ Safety ratings and content filtering
- ✓ Vision capabilities with images
- ✓ Function calling/tool use
- ✓ Extended context windows (1M tokens)
- ✓ Exponential backoff patterns

**Note:** This is a mock test suite demonstrating how Gemini would be tested if implemented.

### 5. ProviderIntegration.test.js (19 tests)
**Integration tests for cross-provider compatibility**

Tests include:
- Provider switching (3 tests)
- Response format normalization (3 tests)
- Error handling consistency (2 tests)
- Connection testing across providers (3 tests)
- Streaming compatibility (3 tests)
- Factory pattern usage (3 tests)
- Multi-provider scenarios (2 tests)

**Key Coverage:**
- ✓ Seamless switching between OpenAI and Claude
- ✓ Consistent response format across providers
- ✓ Consistent error structure
- ✓ Conversation context preservation
- ✓ Parallel requests to different providers
- ✓ Failover scenarios

### 6. ErrorHandling.test.js (34 tests)
**Comprehensive error handling and edge cases**

Tests include:
- Network and connection errors (4 tests)
- HTTP status code errors (12 tests)
- Message validation edge cases (5 tests)
- Streaming error scenarios (3 tests)
- Edge cases and boundary conditions (7 tests)
- Logging and debugging (3 tests)

**Key Coverage:**
- ✓ Network errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND)
- ✓ All HTTP status codes (400, 401, 403, 404, 429, 500, 502, 503, 529)
- ✓ Very long messages and conversations
- ✓ Special characters and unicode
- ✓ Stream interruptions
- ✓ Zero-token and maximum-token responses
- ✓ Concurrent request handling
- ✓ Error logging

## Existing Test Files

### aiProviderFactory.test.js (28 tests)
Original factory tests covering basic functionality.

### openaiService.test.js (30 tests)
Original OpenAI service tests.

### claudeService.test.js (27 tests)
Original Claude service tests.

### aiMessageHandler.test.js (31 tests)
Tests for AI message handling logic.

### aiCostCalculator.test.js (24 tests)
Tests for token cost calculation.

### encryptionHelper.test.js (74 tests)
Tests for API key encryption.

### index.test.js (7 tests)
Tests for main AI service exports.

## Total Test Count

**Total: 461 tests** across 13 test files

New tests added: **240 tests**
- AIProviderFactory.enhanced.test.js: 56 tests
- OpenAIProvider.enhanced.test.js: 45 tests
- AnthropicProvider.enhanced.test.js: 52 tests
- GeminiProvider.mock.test.js: 34 tests
- ProviderIntegration.test.js: 19 tests
- ErrorHandling.test.js: 34 tests

## Coverage Areas

### Provider Creation & Switching
- ✓ Factory pattern usage
- ✓ Dynamic provider selection
- ✓ Model switching within providers
- ✓ Conversation context preservation

### API Interactions
- ✓ OpenAI chat completions
- ✓ Anthropic Claude messages
- ✓ Streaming responses
- ✓ Token usage tracking
- ✓ Response time measurement

### Error Handling
- ✓ Network errors (connection, timeout, DNS)
- ✓ HTTP errors (4xx, 5xx)
- ✓ API-specific errors (rate limits, authentication)
- ✓ Stream interruptions
- ✓ Malformed responses

### Edge Cases
- ✓ Empty messages
- ✓ Very long messages (100k+ characters)
- ✓ Special characters and unicode
- ✓ Zero-token responses
- ✓ Maximum token limits
- ✓ Temperature boundaries (0, 2.0)
- ✓ Single message and 100+ message conversations

### Rate Limiting
- ✓ 429 error handling
- ✓ Rate limit headers
- ✓ Exponential backoff patterns
- ✓ Retry logic

### Input Validation
- ✓ Empty and null messages
- ✓ Invalid message types
- ✓ Missing API keys
- ✓ Invalid models
- ✓ Parameter boundary validation

### Response Normalization
- ✓ Consistent field naming
- ✓ Token usage format
- ✓ Error structure
- ✓ Provider identification

### Streaming
- ✓ Chunk accumulation
- ✓ Event handling (OpenAI vs Claude)
- ✓ Stream completion
- ✓ Stream errors
- ✓ Empty delta handling

## Running Tests

Run all AI service tests:
```bash
npm test -- server/__tests__/services/ai/
```

Run specific test file:
```bash
npm test -- server/__tests__/services/ai/AIProviderFactory.enhanced.test.js
```

Run tests with coverage:
```bash
npm test -- --coverage server/__tests__/services/ai/
```

## Test Patterns Used

### Mocking
- External APIs (OpenAI, Anthropic) are fully mocked
- Logger is mocked to prevent console noise
- Consistent mock setup in beforeEach blocks

### Async Testing
- All async operations use async/await
- Error cases test with rejects.toMatchObject
- Stream testing uses async iterators

### Assertions
- Comprehensive object structure validation
- Property existence checks
- Type validation
- Boundary condition testing
- Error message validation

## Mock Data

### OpenAI Response Format
```javascript
{
  choices: [{
    message: { content: string, role: string },
    finish_reason: 'stop' | 'length' | 'content_filter'
  }],
  usage: {
    prompt_tokens: number,
    completion_tokens: number,
    total_tokens: number
  }
}
```

### Claude Response Format
```javascript
{
  content: [{ text: string }],
  role: 'assistant',
  stop_reason: 'end_turn' | 'max_tokens',
  usage: {
    input_tokens: number,
    output_tokens: number
  }
}
```

### Normalized Response Format
```javascript
{
  provider: 'openai' | 'claude',
  model: string,
  content: string,
  role: string,
  finishReason: string,
  usage: {
    promptTokens: number,
    completionTokens: number,
    totalTokens: number
  },
  responseTime: number,
  rawResponse: object
}
```

## Best Practices

1. **No Source Code Modification**: All tests are isolated and do not modify source code
2. **Proper Mocking**: External dependencies are mocked to ensure fast, reliable tests
3. **Clear Test Names**: Each test has a descriptive name explaining what it tests
4. **Comprehensive Coverage**: Tests cover success paths, error paths, and edge cases
5. **Consistent Patterns**: Similar test structure across all files for maintainability
6. **Async Handling**: Proper async/await usage throughout
7. **Error Validation**: Errors are tested for structure, not just that they throw

## Future Enhancements

Potential areas for additional testing:
- Performance benchmarking tests
- Load testing for concurrent requests
- Integration tests with real API endpoints (optional)
- Cost calculation validation
- Retry logic with actual delays
- WebSocket streaming scenarios
- Multi-language input/output testing
