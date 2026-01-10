import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  IconButton,
  Alert,
  Snackbar,
  CircularProgress,
  Tabs,
  Tab,
  Divider,
  Card,
  CardContent,
  Grid,
  Chip,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Code as CodeIcon,
  Description as DocsIcon,
  ExpandMore as ExpandMoreIcon,
  Fullscreen as FullscreenIcon,
  FormatIndentIncrease as FormatIcon
} from '@mui/icons-material';
import api from '../../utils/api';

// Sample queries for quick start
const SAMPLE_QUERIES = {
  me: {
    name: 'Get Current User',
    query: `query Me {
  me {
    id
    name
    email
    emailVerified
    createdAt
  }
}`
  },
  bots: {
    name: 'List Bots',
    query: `query ListBots($limit: Int, $offset: Int) {
  bots(limit: $limit, offset: $offset) {
    nodes {
      id
      name
      description
      status
      aiProvider
      aiModel
      isActive
      createdAt
    }
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
  }
}`,
    variables: '{\n  "limit": 10,\n  "offset": 0\n}'
  },
  bot: {
    name: 'Get Bot Details',
    query: `query GetBot($id: ID!) {
  bot(id: $id) {
    id
    name
    description
    status
    type
    aiProvider
    aiModel
    systemPrompt
    welcomeMessage
    isActive
    createdAt
    updatedAt
    owner {
      id
      name
      email
    }
  }
}`,
    variables: '{\n  "id": "1"\n}'
  },
  analytics: {
    name: 'Bot Analytics',
    query: `query BotAnalytics($botId: ID!, $period: String!) {
  analytics(botId: $botId, period: $period) {
    botId
    period
    summary {
      totalMessages
      totalConversations
      uniqueUsers
      averageResponseTime
    }
    dailyStats {
      date
      messages
      conversations
      uniqueUsers
    }
  }
}`,
    variables: '{\n  "botId": "1",\n  "period": "30d"\n}'
  },
  apiTokens: {
    name: 'List API Tokens',
    query: `query ListAPITokens {
  apiTokens {
    id
    name
    preview
    isActive
    expiresAt
    lastUsedAt
    createdAt
  }
}`
  },
  createBot: {
    name: 'Create Bot',
    query: `mutation CreateBot($input: CreateBotInput!) {
  createBot(input: $input) {
    id
    name
    description
    status
    aiProvider
    aiModel
    createdAt
  }
}`,
    variables: '{\n  "input": {\n    "name": "My New Bot",\n    "description": "A helpful assistant",\n    "aiProvider": "openai",\n    "aiModel": "gpt-3.5-turbo"\n  }\n}'
  },
  createAPIToken: {
    name: 'Create API Token',
    query: `mutation CreateAPIToken($input: CreateAPITokenInput!) {
  createAPIToken(input: $input) {
    id
    name
    preview
    token
    isActive
    expiresAt
    createdAt
  }
}`,
    variables: '{\n  "input": {\n    "name": "My API Token",\n    "expiresInDays": 90\n  }\n}'
  }
};

// Schema documentation
const SCHEMA_DOCS = [
  {
    type: 'Query',
    fields: [
      { name: 'me', type: 'User', description: 'Get current authenticated user' },
      { name: 'user(id: ID!)', type: 'User', description: 'Get user by ID' },
      { name: 'bot(id: ID!)', type: 'Bot', description: 'Get bot by ID' },
      { name: 'bots(limit, offset, status)', type: 'BotConnection', description: 'List bots with pagination' },
      { name: 'analytics(botId, period)', type: 'Analytics', description: 'Get bot analytics' },
      { name: 'messages(botId, limit, offset)', type: '[Message]', description: 'List messages for a bot' },
      { name: 'apiTokens', type: '[APIToken]', description: 'List API tokens' },
      { name: 'organizations', type: '[Organization]', description: 'List user organizations' }
    ]
  },
  {
    type: 'Mutation',
    fields: [
      { name: 'createBot(input)', type: 'Bot', description: 'Create a new bot' },
      { name: 'updateBot(id, input)', type: 'Bot', description: 'Update a bot' },
      { name: 'deleteBot(id)', type: 'Boolean', description: 'Delete a bot' },
      { name: 'sendMessage(botId, message)', type: 'Message', description: 'Send a message to bot' },
      { name: 'createAPIToken(input)', type: 'APIToken', description: 'Create API token' },
      { name: 'deleteAPIToken(id)', type: 'Boolean', description: 'Delete API token' },
      { name: 'toggleAPIToken(id)', type: 'APIToken', description: 'Toggle token active status' }
    ]
  },
  {
    type: 'Subscription',
    fields: [
      { name: 'messageReceived(botId)', type: 'Message', description: 'Subscribe to new messages' },
      { name: 'botStatusChanged(botId)', type: 'Bot', description: 'Subscribe to bot status changes' },
      { name: 'analyticsUpdated(botId)', type: 'BotAnalytics', description: 'Subscribe to analytics updates' }
    ]
  }
];

const GraphQLExplorer = () => {
  // State
  const [query, setQuery] = useState(SAMPLE_QUERIES.me.query);
  const [variables, setVariables] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [activeTab, setActiveTab] = useState(0);
  const [selectedExample, setSelectedExample] = useState('me');

  // Refs
  const resultRef = useRef(null);

  // Execute query
  const executeQuery = async () => {
    try {
      setLoading(true);
      setError(null);

      let parsedVariables = {};
      if (variables.trim()) {
        try {
          parsedVariables = JSON.parse(variables);
        } catch (e) {
          throw new Error('Invalid JSON in variables');
        }
      }

      const response = await api.post('/graphql', {
        query,
        variables: parsedVariables
      });

      setResult(response.data);

      if (response.data.errors) {
        setError(response.data.errors.map(e => e.message).join('\n'));
      }
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message || err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  // Load example query
  const loadExample = (key) => {
    const example = SAMPLE_QUERIES[key];
    if (example) {
      setQuery(example.query);
      setVariables(example.variables || '');
      setSelectedExample(key);
      setResult(null);
      setError(null);
    }
  };

  // Format query
  const formatQuery = () => {
    try {
      // Simple formatting - add proper indentation
      const formatted = query
        .replace(/\{/g, ' {\n  ')
        .replace(/\}/g, '\n}')
        .replace(/,\s*/g, '\n  ')
        .replace(/\n\s*\n/g, '\n');
      setQuery(formatted);
    } catch (e) {
      showSnackbar('Failed to format query', 'error');
    }
  };

  // Format variables
  const formatVariables = () => {
    try {
      if (variables.trim()) {
        const parsed = JSON.parse(variables);
        setVariables(JSON.stringify(parsed, null, 2));
      }
    } catch (e) {
      showSnackbar('Invalid JSON in variables', 'error');
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showSnackbar('Copied to clipboard');
  };

  // Show snackbar
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            GraphQL Explorer
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Interactive GraphQL API playground with schema documentation
          </Typography>
        </Box>
        <Chip
          icon={<CodeIcon />}
          label="POST /graphql"
          color="primary"
          variant="outlined"
        />
      </Box>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="Explorer" icon={<PlayIcon />} iconPosition="start" />
        <Tab label="Documentation" icon={<DocsIcon />} iconPosition="start" />
      </Tabs>

      {/* Explorer Tab */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          {/* Left Panel - Query Editor */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              {/* Example Selector */}
              <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Load Example</InputLabel>
                  <Select
                    value={selectedExample}
                    label="Load Example"
                    onChange={(e) => loadExample(e.target.value)}
                  >
                    <MenuItem value="me">Get Current User</MenuItem>
                    <MenuItem value="bots">List Bots</MenuItem>
                    <MenuItem value="bot">Get Bot Details</MenuItem>
                    <MenuItem value="analytics">Bot Analytics</MenuItem>
                    <MenuItem value="apiTokens">List API Tokens</MenuItem>
                    <MenuItem value="createBot">Create Bot (Mutation)</MenuItem>
                    <MenuItem value="createAPIToken">Create API Token (Mutation)</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  size="small"
                  startIcon={<FormatIcon />}
                  onClick={formatQuery}
                >
                  Format
                </Button>
              </Box>

              {/* Query Editor */}
              <Typography variant="subtitle2" gutterBottom>Query</Typography>
              <TextField
                fullWidth
                multiline
                rows={12}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your GraphQL query..."
                sx={{
                  mb: 2,
                  '& textarea': {
                    fontFamily: 'monospace',
                    fontSize: '13px'
                  }
                }}
              />

              {/* Variables Editor */}
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2">Variables (JSON)</Typography>
                <Button size="small" onClick={formatVariables}>Format JSON</Button>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={variables}
                onChange={(e) => setVariables(e.target.value)}
                placeholder='{"key": "value"}'
                sx={{
                  mb: 2,
                  '& textarea': {
                    fontFamily: 'monospace',
                    fontSize: '13px'
                  }
                }}
              />

              {/* Execute Button */}
              <Button
                variant="contained"
                fullWidth
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
                onClick={executeQuery}
                disabled={loading || !query.trim()}
              >
                {loading ? 'Executing...' : 'Execute Query'}
              </Button>
            </Paper>
          </Grid>

          {/* Right Panel - Results */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle2">Result</Typography>
                {result && (
                  <Tooltip title="Copy Result">
                    <IconButton
                      size="small"
                      onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}
                    >
                      <CopyIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Box
                ref={resultRef}
                sx={{
                  bgcolor: 'grey.900',
                  color: 'grey.100',
                  p: 2,
                  borderRadius: 1,
                  minHeight: 400,
                  maxHeight: 500,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {result ? (
                  JSON.stringify(result, null, 2)
                ) : (
                  <Typography color="grey.500" sx={{ fontStyle: 'italic' }}>
                    Execute a query to see results here...
                  </Typography>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Documentation Tab */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          {/* Schema Documentation */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Schema Reference
              </Typography>

              {SCHEMA_DOCS.map((section) => (
                <Accordion key={section.type} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1" fontWeight={500}>
                      {section.type}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                      <Box component="thead">
                        <Box component="tr" sx={{ bgcolor: 'grey.100' }}>
                          <Box component="th" sx={{ p: 1, textAlign: 'left' }}>Field</Box>
                          <Box component="th" sx={{ p: 1, textAlign: 'left' }}>Type</Box>
                          <Box component="th" sx={{ p: 1, textAlign: 'left' }}>Description</Box>
                        </Box>
                      </Box>
                      <Box component="tbody">
                        {section.fields.map((field) => (
                          <Box
                            component="tr"
                            key={field.name}
                            sx={{ '&:hover': { bgcolor: 'grey.50' } }}
                          >
                            <Box component="td" sx={{ p: 1, fontFamily: 'monospace', color: 'primary.main' }}>
                              {field.name}
                            </Box>
                            <Box component="td" sx={{ p: 1, fontFamily: 'monospace', color: 'success.main' }}>
                              {field.type}
                            </Box>
                            <Box component="td" sx={{ p: 1 }}>
                              {field.description}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Paper>
          </Grid>

          {/* Quick Reference */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Quick Reference
                </Typography>

                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Endpoint
                </Typography>
                <Paper sx={{ p: 1, bgcolor: 'grey.100', fontFamily: 'monospace', fontSize: '12px' }}>
                  POST /graphql
                </Paper>

                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Authentication
                </Typography>
                <Paper sx={{ p: 1, bgcolor: 'grey.100', fontFamily: 'monospace', fontSize: '12px' }}>
                  Authorization: Bearer {'<token>'}
                </Paper>

                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Request Format
                </Typography>
                <Paper sx={{ p: 1, bgcolor: 'grey.100', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'pre' }}>
{`{
  "query": "...",
  "variables": {...}
}`}
                </Paper>

                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Available Periods
                </Typography>
                <Box display="flex" gap={0.5} flexWrap="wrap">
                  <Chip label="24h" size="small" />
                  <Chip label="7d" size="small" />
                  <Chip label="30d" size="small" />
                  <Chip label="90d" size="small" />
                </Box>

                <Divider sx={{ my: 2 }} />

                <Alert severity="info" sx={{ fontSize: '12px' }}>
                  The GraphQL Playground is only available in development mode.
                  Use this explorer or any GraphQL client in production.
                </Alert>
              </CardContent>
            </Card>

            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  cURL Example
                </Typography>
                <Paper sx={{ p: 1, bgcolor: 'grey.900', color: 'grey.100', fontFamily: 'monospace', fontSize: '11px', overflow: 'auto' }}>
                  <pre style={{ margin: 0 }}>
{`curl -X POST \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer TOKEN" \\
  -d '{"query": "{ me { id name } }"}' \\
  https://api.example.com/graphql`}
                  </pre>
                </Paper>
                <Button
                  size="small"
                  startIcon={<CopyIcon />}
                  onClick={() => copyToClipboard(`curl -X POST \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer TOKEN" \\
  -d '{"query": "{ me { id name } }"}' \\
  https://api.example.com/graphql`)}
                  sx={{ mt: 1 }}
                >
                  Copy
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default GraphQLExplorer;
