/**
 * Clone Templates Page
 * Browse and create clones from pre-built templates
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, CardActions, Typography, Button,
  TextField, InputAdornment, Chip, Avatar, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress, Alert, Tabs, Tab,
  IconButton, Tooltip, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Category as CategoryIcon,
  Mic as MicIcon,
  Edit as EditIcon,
  Psychology as PsychologyIcon,
  ContentCopy as CopyIcon,
  Preview as PreviewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const CloneTemplates = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [newCloneName, setNewCloneName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, [selectedCategory, selectedType, searchTerm]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedType !== 'all') params.append('type', selectedType);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/clones/templates?${params}`);
      const data = await response.json();

      if (data.success) {
        setTemplates(data.templates);
        setCategories(data.categories || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate || !newCloneName.trim()) return;

    try {
      setCreating(true);
      const response = await fetch(`/api/clones/templates/${selectedTemplate.id}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCloneName })
      });

      const data = await response.json();

      if (data.success) {
        setCreateDialogOpen(false);
        navigate(`/clones/${data.clone.id}/edit`);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to create clone');
    } finally {
      setCreating(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'voice': return <MicIcon />;
      case 'style': return <EditIcon />;
      case 'personality': return <PsychologyIcon />;
      default: return <CategoryIcon />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'voice': return 'secondary';
      case 'style': return 'info';
      case 'personality': return 'warning';
      default: return 'primary';
    }
  };

  const openCreateDialog = (template) => {
    setSelectedTemplate(template);
    setNewCloneName(`${template.name} Clone`);
    setCreateDialogOpen(true);
  };

  const openPreviewDialog = (template) => {
    setSelectedTemplate(template);
    setPreviewDialogOpen(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Clone Templates</Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => navigate('/clones/create')}
        >
          Create Custom
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
          sx={{ minWidth: 250 }}
        />

        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={selectedCategory}
            label="Category"
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <MenuItem value="all">All Categories</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={selectedType}
            label="Type"
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <MenuItem value="all">All Types</MenuItem>
            <MenuItem value="voice">Voice</MenuItem>
            <MenuItem value="style">Style</MenuItem>
            <MenuItem value="personality">Personality</MenuItem>
            <MenuItem value="full">Full Clone</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Templates Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {templates.map((template) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={template.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: `${getTypeColor(template.cloneType)}.main`, mr: 1 }}>
                      {getTypeIcon(template.cloneType)}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" noWrap>{template.name}</Typography>
                      {template.featured && (
                        <Chip
                          icon={<StarIcon />}
                          label="Featured"
                          size="small"
                          color="warning"
                        />
                      )}
                    </Box>
                  </Box>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mb: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical'
                    }}
                  >
                    {template.description}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Chip
                      label={template.cloneType}
                      size="small"
                      color={getTypeColor(template.cloneType)}
                      variant="outlined"
                    />
                    <Chip
                      label={template.category}
                      size="small"
                      variant="outlined"
                    />
                    {template.isBuiltIn && (
                      <Chip label="Built-in" size="small" />
                    )}
                  </Box>
                </CardContent>

                <CardActions>
                  <Tooltip title="Preview">
                    <IconButton onClick={() => openPreviewDialog(template)}>
                      <PreviewIcon />
                    </IconButton>
                  </Tooltip>
                  <Box sx={{ flexGrow: 1 }} />
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<CopyIcon />}
                    onClick={() => openCreateDialog(template)}
                  >
                    Use Template
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}

          {templates.length === 0 && !loading && (
            <Grid item xs={12}>
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <Typography color="text.secondary">
                  No templates found matching your criteria
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Clone from Template</DialogTitle>
        <DialogContent>
          {selectedTemplate && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle1" gutterBottom>
                Template: {selectedTemplate.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {selectedTemplate.description}
              </Typography>
              <TextField
                fullWidth
                label="Clone Name"
                value={newCloneName}
                onChange={(e) => setNewCloneName(e.target.value)}
                placeholder="Enter a name for your new clone"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateFromTemplate}
            disabled={creating || !newCloneName.trim()}
          >
            {creating ? <CircularProgress size={24} /> : 'Create Clone'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onClose={() => setPreviewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Template Preview</DialogTitle>
        <DialogContent>
          {selectedTemplate && (
            <Box>
              <Typography variant="h6" gutterBottom>{selectedTemplate.name}</Typography>
              <Typography variant="body1" paragraph>{selectedTemplate.description}</Typography>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Type</Typography>
                  <Chip
                    icon={getTypeIcon(selectedTemplate.cloneType)}
                    label={selectedTemplate.cloneType}
                    color={getTypeColor(selectedTemplate.cloneType)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Category</Typography>
                  <Typography>{selectedTemplate.category}</Typography>
                </Grid>
              </Grid>

              {selectedTemplate.config && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>Configuration</Typography>
                  <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1 }}>
                    <Typography variant="body2">
                      AI Model: {selectedTemplate.config.aiModel || 'GPT-4'}
                    </Typography>
                    <Typography variant="body2">
                      Temperature: {selectedTemplate.config.temperature || 0.7}
                    </Typography>
                    {selectedTemplate.config.toneSettings && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption">Tone Settings:</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                          {Object.entries(selectedTemplate.config.toneSettings).map(([key, value]) => (
                            <Chip key={key} label={`${key}: ${(value * 100).toFixed(0)}%`} size="small" />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              setPreviewDialogOpen(false);
              openCreateDialog(selectedTemplate);
            }}
          >
            Use This Template
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CloneTemplates;
