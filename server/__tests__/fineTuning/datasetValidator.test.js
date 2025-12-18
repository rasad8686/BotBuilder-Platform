/**
 * Dataset Validator Service Tests
 * Tests for dataset validation and conversion: JSONL, CSV, JSON formats
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const datasetValidator = require('../../services/datasetValidator');

describe('Dataset Validator Service', () => {
  const testDir = path.join(os.tmpdir(), 'dataset-validator-tests');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup test files
    try {
      const files = fs.readdirSync(testDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testDir, file));
      });
      fs.rmdirSync(testDir);
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  // ========================================
  // VALIDATE JSONL
  // ========================================
  describe('validateJSONL()', () => {
    it('should validate valid JSONL file', async () => {
      const filePath = path.join(testDir, 'valid.jsonl');
      const content = `{"messages":[{"role":"user","content":"Hello"},{"role":"assistant","content":"Hi there!"}]}
{"messages":[{"role":"system","content":"Be helpful"},{"role":"user","content":"Test"},{"role":"assistant","content":"Response"}]}`;

      fs.writeFileSync(filePath, content);

      const result = await datasetValidator.validateJSONL(filePath);

      expect(result.valid).toBe(true);
      expect(result.total_rows).toBe(2);
      expect(result.valid_rows).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid JSON lines', async () => {
      const filePath = path.join(testDir, 'invalid-json.jsonl');
      const content = `{"messages":[{"role":"user","content":"Hello"},{"role":"assistant","content":"Hi"}]}
{invalid json}
{"messages":[{"role":"user","content":"Test"},{"role":"assistant","content":"Response"}]}`;

      fs.writeFileSync(filePath, content);

      const result = await datasetValidator.validateJSONL(filePath);

      expect(result.valid).toBe(false);
      expect(result.total_rows).toBe(3);
      expect(result.valid_rows).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].line).toBe(2);
      expect(result.errors[0].error).toContain('Invalid JSON');
    });

    it('should detect missing messages array', async () => {
      const filePath = path.join(testDir, 'no-messages.jsonl');
      const content = `{"prompt":"Hello","completion":"Hi"}`;

      fs.writeFileSync(filePath, content);

      const result = await datasetValidator.validateJSONL(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors[0].error).toContain('Missing or invalid "messages" array');
    });

    it('should detect missing user message', async () => {
      const filePath = path.join(testDir, 'no-user.jsonl');
      const content = `{"messages":[{"role":"system","content":"System"},{"role":"assistant","content":"Response"}]}`;

      fs.writeFileSync(filePath, content);

      const result = await datasetValidator.validateJSONL(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors[0].error).toContain('Must have at least one "user" message');
    });

    it('should detect missing assistant message', async () => {
      const filePath = path.join(testDir, 'no-assistant.jsonl');
      // Must have 2 messages to pass "at least 2 messages" check, but no assistant
      const content = `{"messages":[{"role":"system","content":"System prompt"},{"role":"user","content":"Hello"}]}`;

      fs.writeFileSync(filePath, content);

      const result = await datasetValidator.validateJSONL(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors[0].error).toContain('Must have at least one "assistant" message');
    });

    it('should return preview of first 10 rows', async () => {
      const filePath = path.join(testDir, 'preview.jsonl');
      let content = '';
      for (let i = 0; i < 15; i++) {
        content += `{"messages":[{"role":"user","content":"Q${i}"},{"role":"assistant","content":"A${i}"}]}\n`;
      }

      fs.writeFileSync(filePath, content);

      const result = await datasetValidator.validateJSONL(filePath);

      expect(result.preview).toHaveLength(10);
      expect(result.total_rows).toBe(15);
    });

    it('should skip empty lines', async () => {
      const filePath = path.join(testDir, 'empty-lines.jsonl');
      const content = `{"messages":[{"role":"user","content":"Hello"},{"role":"assistant","content":"Hi"}]}

{"messages":[{"role":"user","content":"Test"},{"role":"assistant","content":"Response"}]}
`;

      fs.writeFileSync(filePath, content);

      const result = await datasetValidator.validateJSONL(filePath);

      expect(result.valid).toBe(true);
      expect(result.valid_rows).toBe(2);
    });
  });

  // ========================================
  // VALIDATE TRAINING FORMAT
  // ========================================
  describe('validateTrainingFormat()', () => {
    it('should validate correct format', () => {
      const data = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' }
        ]
      };

      const result = datasetValidator.validateTrainingFormat(data);

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should accept system message', () => {
      const data = {
        messages: [
          { role: 'system', content: 'Be helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' }
        ]
      };

      const result = datasetValidator.validateTrainingFormat(data);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid role', () => {
      const data = {
        messages: [
          { role: 'bot', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' }
        ]
      };

      const result = datasetValidator.validateTrainingFormat(data);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid role');
    });

    it('should reject missing content field', () => {
      const data = {
        messages: [
          { role: 'user' },
          { role: 'assistant', content: 'Hi!' }
        ]
      };

      const result = datasetValidator.validateTrainingFormat(data);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing "content"');
    });

    it('should reject too few messages', () => {
      const data = {
        messages: [
          { role: 'assistant', content: 'Hi!' }
        ]
      };

      const result = datasetValidator.validateTrainingFormat(data);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 2 messages');
    });

    it('should allow empty content', () => {
      const data = {
        messages: [
          { role: 'user', content: '' },
          { role: 'assistant', content: 'Response' }
        ]
      };

      const result = datasetValidator.validateTrainingFormat(data);

      expect(result.valid).toBe(true);
    });
  });

  // ========================================
  // COUNT TOKENS
  // ========================================
  describe('countTokens()', () => {
    it('should estimate token count', () => {
      const text = 'Hello, this is a test message for token counting.';
      const result = datasetValidator.countTokens(text);

      // ~4 chars per token
      expect(result).toBeGreaterThan(0);
      expect(result).toBe(Math.ceil(text.length / 4));
    });

    it('should return 0 for empty string', () => {
      expect(datasetValidator.countTokens('')).toBe(0);
    });

    it('should return 0 for null', () => {
      expect(datasetValidator.countTokens(null)).toBe(0);
    });

    it('should handle long text', () => {
      const longText = 'a'.repeat(10000);
      const result = datasetValidator.countTokens(longText);

      expect(result).toBe(2500); // 10000 / 4
    });
  });

  // ========================================
  // ESTIMATE COST
  // ========================================
  describe('estimateCost()', () => {
    it('should calculate cost for gpt-3.5-turbo', () => {
      const result = datasetValidator.estimateCost(10000, 'gpt-3.5-turbo');

      expect(result.cost).toBeGreaterThan(0);
      expect(result.formatted).toMatch(/^\$[\d.]+$/);
      expect(result.breakdown.tokens).toBe(10000);
      expect(result.breakdown.epochs).toBe(3);
      expect(result.breakdown.totalTokens).toBe(30000);
    });

    it('should calculate cost for gpt-4', () => {
      const result = datasetValidator.estimateCost(10000, 'gpt-4');

      // GPT-4 is more expensive
      expect(result.breakdown.costPer1K).toBe(0.03);
    });

    it('should use default model if not specified', () => {
      const result = datasetValidator.estimateCost(5000);

      expect(result.breakdown.costPer1K).toBe(0.008); // gpt-3.5-turbo default
    });

    it('should handle different models', () => {
      const models = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'claude-3-haiku', 'claude-3-sonnet'];

      models.forEach(model => {
        const result = datasetValidator.estimateCost(1000, model);
        expect(result.cost).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // ========================================
  // CONVERT CSV TO JSONL
  // ========================================
  describe('convertCSVtoJSONL()', () => {
    it('should convert CSV with user/assistant columns', async () => {
      const csvPath = path.join(testDir, 'training.csv');
      const outputPath = path.join(testDir, 'training.jsonl');

      const content = `user,assistant
"Hello there","Hi! How can I help you?"
"What is 2+2?","2+2 equals 4"`;

      fs.writeFileSync(csvPath, content);

      const result = await datasetValidator.convertCSVtoJSONL(csvPath, outputPath);

      expect(result.success).toBe(true);
      expect(result.rows).toBe(2);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Verify output format
      const output = fs.readFileSync(outputPath, 'utf8');
      const lines = output.trim().split('\n');
      expect(lines).toHaveLength(2);

      const firstLine = JSON.parse(lines[0]);
      expect(firstLine.messages).toBeDefined();
      expect(firstLine.messages[0].role).toBe('user');
    });

    it('should convert CSV with prompt/completion columns', async () => {
      const csvPath = path.join(testDir, 'prompt-completion.csv');
      const outputPath = path.join(testDir, 'prompt-completion.jsonl');

      const content = `prompt,completion
"Tell me a joke","Why did the chicken cross the road?"
"What is AI?","AI stands for Artificial Intelligence"`;

      fs.writeFileSync(csvPath, content);

      const result = await datasetValidator.convertCSVtoJSONL(csvPath, outputPath);

      expect(result.success).toBe(true);
      expect(result.rows).toBe(2);
    });

    it('should include system column if present', async () => {
      const csvPath = path.join(testDir, 'with-system.csv');
      const outputPath = path.join(testDir, 'with-system.jsonl');

      const content = `system,user,assistant
"Be concise","Hello","Hi"`;

      fs.writeFileSync(csvPath, content);

      const result = await datasetValidator.convertCSVtoJSONL(csvPath, outputPath);

      expect(result.success).toBe(true);

      const output = fs.readFileSync(outputPath, 'utf8');
      const parsed = JSON.parse(output.trim());
      expect(parsed.messages).toHaveLength(3);
      expect(parsed.messages[0].role).toBe('system');
    });

    it('should handle quoted fields with commas', async () => {
      const csvPath = path.join(testDir, 'quoted.csv');
      const outputPath = path.join(testDir, 'quoted.jsonl');

      const content = `user,assistant
"Hello, world!","Hi there, nice to meet you!"`;

      fs.writeFileSync(csvPath, content);

      const result = await datasetValidator.convertCSVtoJSONL(csvPath, outputPath);

      expect(result.success).toBe(true);

      const output = fs.readFileSync(outputPath, 'utf8');
      const parsed = JSON.parse(output.trim());
      expect(parsed.messages[0].content).toBe('Hello, world!');
    });
  });

  // ========================================
  // CONVERT JSON TO JSONL
  // ========================================
  describe('convertJSONtoJSONL()', () => {
    it('should convert JSON array to JSONL', async () => {
      const jsonPath = path.join(testDir, 'array.json');
      const outputPath = path.join(testDir, 'array.jsonl');

      const content = JSON.stringify([
        { messages: [{ role: 'user', content: 'Q1' }, { role: 'assistant', content: 'A1' }] },
        { messages: [{ role: 'user', content: 'Q2' }, { role: 'assistant', content: 'A2' }] }
      ]);

      fs.writeFileSync(jsonPath, content);

      const result = await datasetValidator.convertJSONtoJSONL(jsonPath, outputPath);

      expect(result.success).toBe(true);
      expect(result.rows).toBe(2);
    });

    it('should convert object format to training format', async () => {
      const jsonPath = path.join(testDir, 'objects.json');
      const outputPath = path.join(testDir, 'objects.jsonl');

      const content = JSON.stringify([
        { user: 'Hello', assistant: 'Hi there!' },
        { prompt: 'Test', completion: 'Response' }
      ]);

      fs.writeFileSync(jsonPath, content);

      const result = await datasetValidator.convertJSONtoJSONL(jsonPath, outputPath);

      expect(result.success).toBe(true);
      expect(result.rows).toBe(2);

      // Wait for stream to finish flushing
      await new Promise(resolve => setTimeout(resolve, 50));

      const output = fs.readFileSync(outputPath, 'utf8');
      const lines = output.trim().split('\n');
      const firstLine = JSON.parse(lines[0]);
      expect(firstLine.messages).toBeDefined();
    });

    it('should handle single object JSON', async () => {
      const jsonPath = path.join(testDir, 'single.json');
      const outputPath = path.join(testDir, 'single.jsonl');

      const content = JSON.stringify({
        messages: [{ role: 'user', content: 'Q' }, { role: 'assistant', content: 'A' }]
      });

      fs.writeFileSync(jsonPath, content);

      const result = await datasetValidator.convertJSONtoJSONL(jsonPath, outputPath);

      expect(result.success).toBe(true);
      expect(result.rows).toBe(1);
    });

    it('should reject invalid JSON', async () => {
      const jsonPath = path.join(testDir, 'invalid.json');
      const outputPath = path.join(testDir, 'invalid.jsonl');

      fs.writeFileSync(jsonPath, '{invalid json}');

      await expect(
        datasetValidator.convertJSONtoJSONL(jsonPath, outputPath)
      ).rejects.toThrow('Invalid JSON');
    });
  });

  // ========================================
  // ANALYZE DATASET
  // ========================================
  describe('analyzeDataset()', () => {
    it('should return full dataset analysis', async () => {
      const filePath = path.join(testDir, 'analyze.jsonl');
      const content = `{"messages":[{"role":"user","content":"Hello there, how are you today?"},{"role":"assistant","content":"I'm doing great, thanks for asking!"}]}
{"messages":[{"role":"user","content":"What is machine learning?"},{"role":"assistant","content":"Machine learning is a subset of AI that enables systems to learn from data."}]}`;

      fs.writeFileSync(filePath, content);

      const result = await datasetValidator.analyzeDataset(filePath, 'gpt-3.5-turbo');

      expect(result.valid).toBe(true);
      expect(result.total_rows).toBe(2);
      expect(result.valid_rows).toBe(2);
      expect(result.token_count).toBeGreaterThan(0);
      expect(result.estimated_cost).toMatch(/^\$[\d.]+$/);
      expect(result.cost_details).toBeDefined();
      expect(result.cost_details.epochs).toBe(3);
    });

    it('should include errors for invalid dataset', async () => {
      const filePath = path.join(testDir, 'analyze-invalid.jsonl');
      const content = `{"messages":[{"role":"user","content":"Valid"}{"role":"assistant","content":"Response"}]}
{invalid}`;

      fs.writeFileSync(filePath, content);

      const result = await datasetValidator.analyzeDataset(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ========================================
  // PARSE CSV LINE
  // ========================================
  describe('parseCSVLine()', () => {
    it('should parse simple CSV line', () => {
      const result = datasetValidator.parseCSVLine('a,b,c');

      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle quoted fields', () => {
      const result = datasetValidator.parseCSVLine('"hello","world"');

      expect(result).toEqual(['hello', 'world']);
    });

    it('should handle commas in quoted fields', () => {
      const result = datasetValidator.parseCSVLine('"hello, world","test"');

      expect(result).toEqual(['hello, world', 'test']);
    });

    it('should handle escaped quotes', () => {
      const result = datasetValidator.parseCSVLine('"say ""hello""",test');

      expect(result).toEqual(['say "hello"', 'test']);
    });

    it('should handle empty fields', () => {
      const result = datasetValidator.parseCSVLine('a,,c');

      expect(result).toEqual(['a', '', 'c']);
    });
  });

  // ========================================
  // COUNT FILE TOKENS
  // ========================================
  describe('countFileTokens()', () => {
    it('should count total tokens in file', async () => {
      const filePath = path.join(testDir, 'token-count.jsonl');
      const content = `{"messages":[{"role":"user","content":"Hello"},{"role":"assistant","content":"Hi there!"}]}
{"messages":[{"role":"user","content":"Test message"},{"role":"assistant","content":"Response here"}]}`;

      fs.writeFileSync(filePath, content);

      const result = await datasetValidator.countFileTokens(filePath);

      expect(result).toBeGreaterThan(0);
    });

    it('should skip invalid lines', async () => {
      const filePath = path.join(testDir, 'token-count-invalid.jsonl');
      const content = `{"messages":[{"role":"user","content":"Hello"},{"role":"assistant","content":"Hi"}]}
{invalid}
{"messages":[{"role":"user","content":"Test"},{"role":"assistant","content":"Response"}]}`;

      fs.writeFileSync(filePath, content);

      const result = await datasetValidator.countFileTokens(filePath);

      expect(result).toBeGreaterThan(0);
    });
  });
});
