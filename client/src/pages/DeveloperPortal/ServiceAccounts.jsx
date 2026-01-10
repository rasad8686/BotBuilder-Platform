import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
  Collapse,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Key as KeyIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Code as CodeIcon,
  GitHub as GitHubIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import api from '../../utils/api';

const ServiceAccounts = () => {
  // State
  const [serviceAccounts, setServiceAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [newTokenDialogOpen, setNewTokenDialogOpen] = useState(false);

  // Selected items
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [expandedAccount, setExpandedAccount] = useState(null);
  const [accountTokens, setAccountTokens] = useState({});

  // Form states
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [tokenFormData, setTokenFormData] = useState({ tokenName: '', expiresInDays: '' });
  const [newToken, setNewToken] = useState(null);
  const [showToken, setShowToken] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Fetch service accounts
  const fetchServiceAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/service-accounts');
      setServiceAccounts(response.data.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load service accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServiceAccounts();
  }, [fetchServiceAccounts]);

  // Fetch tokens for a service account
  const fetchTokens = async (accountId) => {
    try {
      const response = await api.get(`/api/service-accounts/${accountId}/tokens`);
      setAccountTokens(prev => ({
        ...prev,
        [accountId]: response.data.data || []
      }));
    } catch (err) {
      showSnackbar('Failed to load tokens', 'error');
    }
  };

  // Expand/collapse account
  const handleExpandAccount = async (accountId) => {
    if (expandedAccount === accountId) {
      setExpandedAccount(null);
    } else {
      setExpandedAccount(accountId);
      if (!accountTokens[accountId]) {
        await fetchTokens(accountId);
      }
    }
  };

  // Show snackbar
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Create service account
  const handleCreate = async () => {
    try {
      if (!formData.name.trim()) {
        showSnackbar('Name is required', 'error');
        return;
      }
      await api.post('/api/service-accounts', formData);
      showSnackbar('Service account created successfully');
      setCreateDialogOpen(false);
      setFormData({ name: '', description: '' });
      fetchServiceAccounts();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to create service account', 'error');
    }
  };

  // Update service account
  const handleUpdate = async () => {
    try {
      await api.put(`/api/service-accounts/${selectedAccount.id}`, formData);
      showSnackbar('Service account updated successfully');
      setEditDialogOpen(false);
      fetchServiceAccounts();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to update service account', 'error');
    }
  };

  // Delete service account
  const handleDelete = async () => {
    try {
      await api.delete(`/api/service-accounts/${selectedAccount.id}`);
      showSnackbar('Service account deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedAccount(null);
      fetchServiceAccounts();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to delete service account', 'error');
    }
  };

  // Toggle service account active status
  const handleToggleActive = async (account) => {
    try {
      await api.put(`/api/service-accounts/${account.id}`, { isActive: !account.isActive });
      showSnackbar(`Service account ${account.isActive ? 'deactivated' : 'activated'}`);
      fetchServiceAccounts();
    } catch (err) {
      showSnackbar('Failed to update service account', 'error');
    }
  };

  // Create token
  const handleCreateToken = async () => {
    try {
      if (!tokenFormData.tokenName.trim()) {
        showSnackbar('Token name is required', 'error');
        return;
      }
      const response = await api.post(`/api/service-accounts/${selectedAccount.id}/tokens`, {
        tokenName: tokenFormData.tokenName,
        expiresInDays: tokenFormData.expiresInDays ? parseInt(tokenFormData.expiresInDays) : null
      });
      setNewToken(response.data.data);
      setNewTokenDialogOpen(true);
      setTokenDialogOpen(false);
      setTokenFormData({ tokenName: '', expiresInDays: '' });
      fetchTokens(selectedAccount.id);
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to create token', 'error');
    }
  };

  // Delete token
  const handleDeleteToken = async (accountId, tokenId) => {
    try {
      await api.delete(`/api/service-accounts/${accountId}/tokens/${tokenId}`);
      showSnackbar('Token deleted successfully');
      fetchTokens(accountId);
    } catch (err) {
      showSnackbar('Failed to delete token', 'error');
    }
  };

  // Toggle token active status
  const handleToggleToken = async (accountId, tokenId) => {
    try {
      await api.patch(`/api/service-accounts/${accountId}/tokens/${tokenId}/toggle`);
      showSnackbar('Token status updated');
      fetchTokens(accountId);
    } catch (err) {
      showSnackbar('Failed to update token', 'error');
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showSnackbar('Copied to clipboard');
  };

  // Open edit dialog
  const openEditDialog = (account) => {
    setSelectedAccount(account);
    setFormData({ name: account.name, description: account.description || '' });
    setEditDialogOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (account) => {
    setSelectedAccount(account);
    setDeleteDialogOpen(true);
  };

  // Open token creation dialog
  const openTokenDialog = (account) => {
    setSelectedAccount(account);
    setTokenFormData({ tokenName: '', expiresInDays: '' });
    setTokenDialogOpen(true);
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Service Accounts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage service accounts for CI/CD pipelines and automated systems
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setFormData({ name: '', description: '' });
            setCreateDialogOpen(true);
          }}
        >
          Create Service Account
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="Service Accounts" />
        <Tab label="Integration Guide" icon={<CodeIcon />} iconPosition="start" />
      </Tabs>

      {/* Service Accounts Tab */}
      {activeTab === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width="50px" />
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="center">Tokens</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell>Last Used</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {serviceAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No service accounts yet. Create one to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                serviceAccounts.map((account) => (
                  <React.Fragment key={account.id}>
                    <TableRow hover>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleExpandAccount(account.id)}
                        >
                          {expandedAccount === account.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <SettingsIcon color="action" />
                          <Typography fontWeight={500}>{account.name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                          {account.description || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={<KeyIcon />}
                          label={account.tokenCount}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={account.isActive ? <CheckCircleIcon /> : <CancelIcon />}
                          label={account.isActive ? 'Active' : 'Inactive'}
                          color={account.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(account.lastUsedAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(account.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Create Token">
                          <IconButton size="small" onClick={() => openTokenDialog(account)}>
                            <KeyIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEditDialog(account)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => openDeleteDialog(account)}>
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Token List */}
                    <TableRow>
                      <TableCell colSpan={8} sx={{ py: 0 }}>
                        <Collapse in={expandedAccount === account.id}>
                          <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                              <Typography variant="subtitle2">API Tokens</Typography>
                              <Button
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={() => openTokenDialog(account)}
                              >
                                New Token
                              </Button>
                            </Box>
                            {accountTokens[account.id]?.length === 0 ? (
                              <Typography variant="body2" color="text.secondary">
                                No tokens created yet
                              </Typography>
                            ) : (
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Token Preview</TableCell>
                                    <TableCell align="center">Status</TableCell>
                                    <TableCell>Expires</TableCell>
                                    <TableCell>Last Used</TableCell>
                                    <TableCell>Requests</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {accountTokens[account.id]?.map((token) => (
                                    <TableRow key={token.id}>
                                      <TableCell>{token.name}</TableCell>
                                      <TableCell>
                                        <code>{token.preview}</code>
                                      </TableCell>
                                      <TableCell align="center">
                                        <Switch
                                          size="small"
                                          checked={token.isActive}
                                          onChange={() => handleToggleToken(account.id, token.id)}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        {token.expiresAt ? formatDate(token.expiresAt) : 'Never'}
                                      </TableCell>
                                      <TableCell>{formatDate(token.lastUsedAt)}</TableCell>
                                      <TableCell>{token.usage?.requestCount || 0}</TableCell>
                                      <TableCell align="right">
                                        <IconButton
                                          size="small"
                                          color="error"
                                          onClick={() => handleDeleteToken(account.id, token.id)}
                                        >
                                          <DeleteIcon fontSize="small" />
                                        </IconButton>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Integration Guide Tab */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          {/* GitHub Actions */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <GitHubIcon />
                  <Typography variant="h6">GitHub Actions</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Use service account tokens in your GitHub Actions workflows:
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'grey.100', overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: '12px' }}>
{`# .github/workflows/deploy.yml
name: Deploy Bot

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to BotBuilder
        env:
          BOTBUILDER_TOKEN: \${{ secrets.BOTBUILDER_SERVICE_TOKEN }}
        run: |
          curl -X POST \\
            -H "Authorization: Bearer \$BOTBUILDER_TOKEN" \\
            -H "Content-Type: application/json" \\
            -d '{"botId": "123", "version": "v1.0.0"}' \\
            https://api.botbuilder.com/api/bots/deploy`}
                  </pre>
                </Paper>
                <Button
                  size="small"
                  startIcon={<CopyIcon />}
                  onClick={() => copyToClipboard(`# .github/workflows/deploy.yml
name: Deploy Bot

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to BotBuilder
        env:
          BOTBUILDER_TOKEN: \${{ secrets.BOTBUILDER_SERVICE_TOKEN }}
        run: |
          curl -X POST \\
            -H "Authorization: Bearer $BOTBUILDER_TOKEN" \\
            -H "Content-Type: application/json" \\
            -d '{"botId": "123", "version": "v1.0.0"}' \\
            https://api.botbuilder.com/api/bots/deploy`)}
                  sx={{ mt: 1 }}
                >
                  Copy
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* GitLab CI */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <CodeIcon />
                  <Typography variant="h6">GitLab CI</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Configure GitLab CI/CD with service account tokens:
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'grey.100', overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: '12px' }}>
{`# .gitlab-ci.yml
stages:
  - deploy

deploy_bot:
  stage: deploy
  script:
    - |
      curl -X POST \\
        -H "Authorization: Bearer \$BOTBUILDER_SERVICE_TOKEN" \\
        -H "Content-Type: application/json" \\
        -d '{"botId": "123"}' \\
        https://api.botbuilder.com/api/bots/deploy
  only:
    - main
  variables:
    BOTBUILDER_SERVICE_TOKEN: \$BOTBUILDER_TOKEN`}
                  </pre>
                </Paper>
                <Button
                  size="small"
                  startIcon={<CopyIcon />}
                  onClick={() => copyToClipboard(`# .gitlab-ci.yml
stages:
  - deploy

deploy_bot:
  stage: deploy
  script:
    - |
      curl -X POST \\
        -H "Authorization: Bearer $BOTBUILDER_SERVICE_TOKEN" \\
        -H "Content-Type: application/json" \\
        -d '{"botId": "123"}' \\
        https://api.botbuilder.com/api/bots/deploy
  only:
    - main
  variables:
    BOTBUILDER_SERVICE_TOKEN: $BOTBUILDER_TOKEN`)}
                  sx={{ mt: 1 }}
                >
                  Copy
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Node.js SDK */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <CodeIcon />
                  <Typography variant="h6">Node.js</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Use service accounts in your Node.js applications:
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'grey.100', overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: '12px' }}>
{`const axios = require('axios');

const client = axios.create({
  baseURL: 'https://api.botbuilder.com',
  headers: {
    'Authorization': \`Bearer \${process.env.BOTBUILDER_TOKEN}\`,
    'Content-Type': 'application/json'
  }
});

// List bots
const bots = await client.get('/api/bots');

// Send message
await client.post('/api/messages', {
  botId: '123',
  message: 'Hello from CI/CD!'
});`}
                  </pre>
                </Paper>
              </CardContent>
            </Card>
          </Grid>

          {/* Python */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <CodeIcon />
                  <Typography variant="h6">Python</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Integrate with Python scripts and automation:
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'grey.100', overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: '12px' }}>
{`import os
import requests

TOKEN = os.environ['BOTBUILDER_TOKEN']
BASE_URL = 'https://api.botbuilder.com'

headers = {
    'Authorization': f'Bearer {TOKEN}',
    'Content-Type': 'application/json'
}

# List bots
response = requests.get(
    f'{BASE_URL}/api/bots',
    headers=headers
)
bots = response.json()

# Deploy bot
requests.post(
    f'{BASE_URL}/api/bots/deploy',
    headers=headers,
    json={'botId': '123'}
)`}
                  </pre>
                </Paper>
              </CardContent>
            </Card>
          </Grid>

          {/* Best Practices */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Security Best Practices
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Alert severity="info" icon={<KeyIcon />}>
                      <Typography variant="subtitle2">Use Environment Variables</Typography>
                      <Typography variant="body2">
                        Never hardcode tokens in your code. Always use environment variables or secrets management.
                      </Typography>
                    </Alert>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Alert severity="warning" icon={<KeyIcon />}>
                      <Typography variant="subtitle2">Rotate Tokens Regularly</Typography>
                      <Typography variant="body2">
                        Set expiration dates and rotate tokens periodically for better security.
                      </Typography>
                    </Alert>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Alert severity="success" icon={<KeyIcon />}>
                      <Typography variant="subtitle2">Use Separate Accounts</Typography>
                      <Typography variant="body2">
                        Create separate service accounts for different environments (dev, staging, production).
                      </Typography>
                    </Alert>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Service Account</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., CI/CD Pipeline"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description for this service account"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Service Account</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdate} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Service Account</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            This action cannot be undone!
          </Alert>
          <Typography>
            Are you sure you want to delete <strong>{selectedAccount?.name}</strong>?
            This will also delete all associated API tokens.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Create Token Dialog */}
      <Dialog open={tokenDialogOpen} onClose={() => setTokenDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create API Token</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create a new API token for <strong>{selectedAccount?.name}</strong>
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Token Name"
            fullWidth
            value={tokenFormData.tokenName}
            onChange={(e) => setTokenFormData({ ...tokenFormData, tokenName: e.target.value })}
            placeholder="e.g., Production Deploy Key"
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Expiration</InputLabel>
            <Select
              value={tokenFormData.expiresInDays}
              label="Expiration"
              onChange={(e) => setTokenFormData({ ...tokenFormData, expiresInDays: e.target.value })}
            >
              <MenuItem value="">Never expires</MenuItem>
              <MenuItem value="30">30 days</MenuItem>
              <MenuItem value="60">60 days</MenuItem>
              <MenuItem value="90">90 days</MenuItem>
              <MenuItem value="180">180 days</MenuItem>
              <MenuItem value="365">1 year</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTokenDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateToken} variant="contained">Create Token</Button>
        </DialogActions>
      </Dialog>

      {/* New Token Display Dialog */}
      <Dialog open={newTokenDialogOpen} onClose={() => setNewTokenDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <CheckCircleIcon color="success" />
            Token Created Successfully
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="subtitle2">Save this token now!</Typography>
            <Typography variant="body2">
              This is the only time you will see this token. Store it securely.
            </Typography>
          </Alert>

          <Typography variant="subtitle2" gutterBottom>Your API Token:</Typography>
          <Paper sx={{ p: 2, bgcolor: 'grey.100', display: 'flex', alignItems: 'center', gap: 1 }}>
            <code style={{ flex: 1, wordBreak: 'break-all' }}>
              {showToken ? newToken?.token : '••••••••••••••••••••••••••••••••'}
            </code>
            <IconButton onClick={() => setShowToken(!showToken)} size="small">
              {showToken ? <VisibilityOffIcon /> : <VisibilityIcon />}
            </IconButton>
            <IconButton onClick={() => copyToClipboard(newToken?.token)} size="small">
              <CopyIcon />
            </IconButton>
          </Paper>

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" color="text.secondary">
            Token Name: <strong>{newToken?.name}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Expires: <strong>{newToken?.expiresAt ? formatDate(newToken.expiresAt) : 'Never'}</strong>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setNewTokenDialogOpen(false);
              setNewToken(null);
              setShowToken(false);
            }}
            variant="contained"
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
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

export default ServiceAccounts;
