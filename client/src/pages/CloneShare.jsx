/**
 * Clone Share Page
 * Share clones with users and organizations
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, TextField,
  FormControl, InputLabel, Select, MenuItem, CircularProgress,
  Alert, List, ListItem, ListItemText, ListItemIcon, ListItemSecondaryAction,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, Avatar, Divider, Switch, FormControlLabel, Tooltip, Paper,
  InputAdornment, Table, TableBody, TableCell, TableHead, TableRow
} from '@mui/material';
import {
  Share as ShareIcon,
  Link as LinkIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Build as BuildIcon,
  AdminPanelSettings as AdminIcon,
  Lock as LockIcon,
  AccessTime as TimeIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { useParams } from 'react-router-dom';

const CloneShare = () => {
  const { cloneId } = useParams();
  const [clone, setClone] = useState(null);
  const [shares, setShares] = useState({ userShares: [], orgShares: [], shareLinks: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Share with user dialog
  const [shareUserDialog, setShareUserDialog] = useState(false);
  const [shareUserEmail, setShareUserEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('use');
  const [shareOptions, setShareOptions] = useState({
    canTrain: false,
    canExport: false,
    expiresAt: ''
  });
  const [sharing, setSharing] = useState(false);

  // Share link dialog
  const [shareLinkDialog, setShareLinkDialog] = useState(false);
  const [linkOptions, setLinkOptions] = useState({
    permission: 'view',
    maxUses: '',
    password: '',
    requireEmail: false,
    expiresIn: '7'
  });
  const [generatedLink, setGeneratedLink] = useState(null);

  useEffect(() => {
    if (cloneId) {
      fetchClone();
      fetchShares();
    }
  }, [cloneId]);

  const fetchClone = async () => {
    try {
      const response = await fetch(`/api/clones/${cloneId}`);
      const data = await response.json();
      if (data.success) {
        setClone(data.clone);
      }
    } catch (err) {
      setError('Failed to load clone');
    }
  };

  const fetchShares = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/clones/${cloneId}/shares`);
      const data = await response.json();
      if (data.success) {
        setShares(data);
      }
    } catch (err) {
      setError('Failed to load shares');
    } finally {
      setLoading(false);
    }
  };

  const handleShareWithUser = async () => {
    try {
      setSharing(true);
      const response = await fetch(`/api/clones/${cloneId}/share/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: shareUserEmail,
          permissionLevel: sharePermission,
          ...shareOptions
        })
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Clone shared successfully');
        setShareUserDialog(false);
        setShareUserEmail('');
        fetchShares();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to share clone');
    } finally {
      setSharing(false);
    }
  };

  const handleGenerateLink = async () => {
    try {
      setSharing(true);
      const response = await fetch(`/api/clones/${cloneId}/share/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissionLevel: linkOptions.permission,
          maxUses: linkOptions.maxUses ? parseInt(linkOptions.maxUses) : null,
          password: linkOptions.password || null,
          requireEmail: linkOptions.requireEmail,
          expiresIn: linkOptions.expiresIn
        })
      });

      const data = await response.json();
      if (data.success) {
        setGeneratedLink(data);
        fetchShares();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to generate link');
    } finally {
      setSharing(false);
    }
  };

  const handleRevokeShare = async (shareId) => {
    try {
      const response = await fetch(`/api/clones/${cloneId}/shares/${shareId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Share revoked');
        fetchShares();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to revoke share');
    }
  };

  const handleRevokeLink = async (linkId) => {
    try {
      const response = await fetch(`/api/clones/${cloneId}/share/links/${linkId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Link revoked');
        fetchShares();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to revoke link');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard');
  };

  const getPermissionIcon = (level) => {
    switch (level) {
      case 'view': return <ViewIcon />;
      case 'use': return <BuildIcon />;
      case 'edit': return <EditIcon />;
      case 'admin': return <AdminIcon />;
      default: return <ViewIcon />;
    }
  };

  const getPermissionColor = (level) => {
    switch (level) {
      case 'view': return 'default';
      case 'use': return 'primary';
      case 'edit': return 'warning';
      case 'admin': return 'error';
      default: return 'default';
    }
  };

  if (loading && !clone) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>Share Clone</Typography>
          {clone && (
            <Typography variant="body1" color="text.secondary">
              {clone.name}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<LinkIcon />}
            onClick={() => setShareLinkDialog(true)}
          >
            Create Link
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonIcon />}
            onClick={() => setShareUserDialog(true)}
          >
            Share with User
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* User Shares */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Shared with Users
              </Typography>

              {shares.userShares.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  Not shared with any users yet
                </Typography>
              ) : (
                <List>
                  {shares.userShares.map((share) => (
                    <ListItem key={share.id}>
                      <ListItemIcon>
                        <Avatar sx={{ width: 32, height: 32 }}>
                          {share.shared_with_name?.[0] || 'U'}
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={share.shared_with_name || share.shared_with_email}
                        secondary={
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                            <Chip
                              icon={getPermissionIcon(share.permission_level)}
                              label={share.permission_level}
                              size="small"
                              color={getPermissionColor(share.permission_level)}
                            />
                            {share.can_train && <Chip label="Train" size="small" />}
                            {share.can_export && <Chip label="Export" size="small" />}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton onClick={() => handleRevokeShare(share.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Share Links */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <LinkIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Share Links
              </Typography>

              {shares.shareLinks.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No share links created
                </Typography>
              ) : (
                <List>
                  {shares.shareLinks.map((link) => (
                    <ListItem key={link.id}>
                      <ListItemIcon>
                        {link.password_hash ? <LockIcon /> : <LinkIcon />}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {link.url}
                            </Typography>
                            <IconButton size="small" onClick={() => copyToClipboard(link.url)}>
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                            <Chip
                              label={link.permission_level}
                              size="small"
                              color={getPermissionColor(link.permission_level)}
                            />
                            {link.max_uses && (
                              <Chip label={`${link.use_count}/${link.max_uses} uses`} size="small" />
                            )}
                            {link.expires_at && (
                              <Chip
                                icon={<TimeIcon />}
                                label={new Date(link.expires_at).toLocaleDateString()}
                                size="small"
                              />
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton onClick={() => handleRevokeLink(link.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Organization Shares */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <BusinessIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Shared with Organizations
              </Typography>

              {shares.orgShares.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  Not shared with any organizations
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Organization</TableCell>
                      <TableCell>Permission</TableCell>
                      <TableCell>Options</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {shares.orgShares.map((share) => (
                      <TableRow key={share.id}>
                        <TableCell>{share.shared_with_org_name}</TableCell>
                        <TableCell>
                          <Chip
                            label={share.permission_level}
                            size="small"
                            color={getPermissionColor(share.permission_level)}
                          />
                        </TableCell>
                        <TableCell>
                          {share.can_train && <Chip label="Train" size="small" sx={{ mr: 0.5 }} />}
                          {share.can_export && <Chip label="Export" size="small" />}
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => handleRevokeShare(share.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Share with User Dialog */}
      <Dialog open={shareUserDialog} onClose={() => setShareUserDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Share with User</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="User Email"
            value={shareUserEmail}
            onChange={(e) => setShareUserEmail(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
          />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Permission Level</InputLabel>
            <Select
              value={sharePermission}
              label="Permission Level"
              onChange={(e) => setSharePermission(e.target.value)}
            >
              <MenuItem value="view">View - Can only view</MenuItem>
              <MenuItem value="use">Use - Can use clone</MenuItem>
              <MenuItem value="edit">Edit - Can modify settings</MenuItem>
              <MenuItem value="admin">Admin - Full access</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={shareOptions.canTrain}
                onChange={(e) => setShareOptions({ ...shareOptions, canTrain: e.target.checked })}
              />
            }
            label="Allow training"
          />

          <FormControlLabel
            control={
              <Switch
                checked={shareOptions.canExport}
                onChange={(e) => setShareOptions({ ...shareOptions, canExport: e.target.checked })}
              />
            }
            label="Allow export"
          />

          <TextField
            fullWidth
            type="date"
            label="Expires at (optional)"
            value={shareOptions.expiresAt}
            onChange={(e) => setShareOptions({ ...shareOptions, expiresAt: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareUserDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleShareWithUser}
            disabled={!shareUserEmail || sharing}
          >
            {sharing ? <CircularProgress size={24} /> : 'Share'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Generate Link Dialog */}
      <Dialog open={shareLinkDialog} onClose={() => setShareLinkDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Share Link</DialogTitle>
        <DialogContent>
          {generatedLink ? (
            <Box sx={{ py: 2 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Link created successfully!</Typography>
              </Alert>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <TextField
                  fullWidth
                  value={generatedLink.url}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => copyToClipboard(generatedLink.url)}>
                          <CopyIcon />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Expires: {new Date(generatedLink.expiresAt).toLocaleString()}
                </Typography>
              </Paper>
            </Box>
          ) : (
            <Box sx={{ mt: 2 }}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Permission</InputLabel>
                <Select
                  value={linkOptions.permission}
                  label="Permission"
                  onChange={(e) => setLinkOptions({ ...linkOptions, permission: e.target.value })}
                >
                  <MenuItem value="view">View only</MenuItem>
                  <MenuItem value="use">Use clone</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                type="number"
                label="Max uses (optional)"
                value={linkOptions.maxUses}
                onChange={(e) => setLinkOptions({ ...linkOptions, maxUses: e.target.value })}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                type="password"
                label="Password protection (optional)"
                value={linkOptions.password}
                onChange={(e) => setLinkOptions({ ...linkOptions, password: e.target.value })}
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Expires in</InputLabel>
                <Select
                  value={linkOptions.expiresIn}
                  label="Expires in"
                  onChange={(e) => setLinkOptions({ ...linkOptions, expiresIn: e.target.value })}
                >
                  <MenuItem value="1">1 day</MenuItem>
                  <MenuItem value="7">7 days</MenuItem>
                  <MenuItem value="30">30 days</MenuItem>
                  <MenuItem value="90">90 days</MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={linkOptions.requireEmail}
                    onChange={(e) => setLinkOptions({ ...linkOptions, requireEmail: e.target.checked })}
                  />
                }
                label="Require email to access"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShareLinkDialog(false);
            setGeneratedLink(null);
          }}>
            {generatedLink ? 'Close' : 'Cancel'}
          </Button>
          {!generatedLink && (
            <Button
              variant="contained"
              onClick={handleGenerateLink}
              disabled={sharing}
            >
              {sharing ? <CircularProgress size={24} /> : 'Generate Link'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CloneShare;
