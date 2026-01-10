import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, Container, Typography, Paper, TextField, Button, FormControl, InputLabel, Select, MenuItem,
  Grid, Alert, Breadcrumbs, Divider, Chip, IconButton
} from '@mui/material';
import { Send, ArrowBack, Add, Close, Image, VideoLibrary } from '@mui/icons-material';
import api from '../../utils/api';

const categories = [
  { value: 'chatbot', label: 'Chatbot' },
  { value: 'customer-support', label: 'Customer Support' },
  { value: 'sales', label: 'Sales' },
  { value: 'internal', label: 'Internal Tool' },
  { value: 'other', label: 'Other' }
];

const industries = [
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance' },
  { value: 'education', label: 'Education' },
  { value: 'technology', label: 'Technology' },
  { value: 'retail', label: 'Retail' },
  { value: 'other', label: 'Other' }
];

const featureOptions = ['AI', 'Voice', 'Multi-channel', 'WhatsApp', 'Telegram', 'Slack', 'Knowledge Base', 'Analytics', 'Workflows', 'Integrations'];

function ShowcaseSubmit() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '', tagline: '', description: '', logo_url: '', cover_image: '',
    screenshots: [], video_url: '', website_url: '', demo_url: '',
    category: '', industry: '', tags: [], features_used: [],
    testimonial_text: '', testimonial_author: '', testimonial_role: ''
  });
  const [tagInput, setTagInput] = useState('');
  const [screenshotInput, setScreenshotInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const handleAddScreenshot = () => {
    if (screenshotInput.trim()) {
      setFormData(prev => ({ ...prev, screenshots: [...prev.screenshots, screenshotInput.trim()] }));
      setScreenshotInput('');
    }
  };

  const handleRemoveScreenshot = (idx) => {
    setFormData(prev => ({ ...prev, screenshots: prev.screenshots.filter((_, i) => i !== idx) }));
  };

  const handleToggleFeature = (feature) => {
    setFormData(prev => ({
      ...prev,
      features_used: prev.features_used.includes(feature)
        ? prev.features_used.filter(f => f !== feature)
        : [...prev.features_used, feature]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) { setError('Title is required'); return; }

    try {
      setSubmitting(true);
      setError(null);
      await api.post('/api/showcase', formData);
      navigate('/showcase/my', { state: { message: 'Project submitted for review!' } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link to="/showcase" style={{ textDecoration: 'none', color: 'inherit' }}>Showcase</Link>
        <Typography color="text.primary">Submit Project</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>Submit Your Project</Typography>
        <Typography variant="body1" color="text.secondary">Share what you've built with our community</Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit}>
          {/* Basic Info */}
          <Typography variant="h6" gutterBottom>Basic Information</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Project Title" name="title" value={formData.title} onChange={handleChange} required />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Tagline" name="tagline" value={formData.tagline} onChange={handleChange} placeholder="A short catchy description" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={4} label="Description" name="description" value={formData.description} onChange={handleChange} placeholder="Tell us about your project..." />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Categorization */}
          <Typography variant="h6" gutterBottom>Categorization</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select name="category" value={formData.category} label="Category" onChange={handleChange}>
                  {categories.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Industry</InputLabel>
                <Select name="industry" value={formData.industry} label="Industry" onChange={handleChange}>
                  {industries.map(i => <MenuItem key={i.value} value={i.value}>{i.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField size="small" label="Add Tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())} />
                <Button onClick={handleAddTag} startIcon={<Add />}>Add</Button>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                {formData.tags.map(tag => <Chip key={tag} label={tag} onDelete={() => handleRemoveTag(tag)} />)}
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Media */}
          <Typography variant="h6" gutterBottom>Media</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Logo URL" name="logo_url" value={formData.logo_url} onChange={handleChange} placeholder="https://..." />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Cover Image URL" name="cover_image" value={formData.cover_image} onChange={handleChange} placeholder="https://..." />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField size="small" label="Screenshot URL" value={screenshotInput} onChange={(e) => setScreenshotInput(e.target.value)} sx={{ flexGrow: 1 }} />
                <Button onClick={handleAddScreenshot} startIcon={<Image />}>Add</Button>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                {formData.screenshots.map((s, idx) => <Chip key={idx} label={`Screenshot ${idx + 1}`} onDelete={() => handleRemoveScreenshot(idx)} />)}
              </Box>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Video URL (YouTube/Vimeo embed)" name="video_url" value={formData.video_url} onChange={handleChange} placeholder="https://www.youtube.com/embed/..." />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Links */}
          <Typography variant="h6" gutterBottom>Links</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Website URL" name="website_url" value={formData.website_url} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Demo URL" name="demo_url" value={formData.demo_url} onChange={handleChange} />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Features Used */}
          <Typography variant="h6" gutterBottom>Features Used</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
            {featureOptions.map(f => (
              <Chip key={f} label={f} onClick={() => handleToggleFeature(f)} color={formData.features_used.includes(f) ? 'primary' : 'default'} variant={formData.features_used.includes(f) ? 'filled' : 'outlined'} />
            ))}
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Testimonial */}
          <Typography variant="h6" gutterBottom>Testimonial (Optional)</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={3} label="Testimonial" name="testimonial_text" value={formData.testimonial_text} onChange={handleChange} placeholder="What do your users say?" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Author Name" name="testimonial_author" value={formData.testimonial_author} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Author Role" name="testimonial_role" value={formData.testimonial_role} onChange={handleChange} placeholder="CEO at Company" />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
            <Button variant="outlined" startIcon={<ArrowBack />} component={Link} to="/showcase">Cancel</Button>
            <Button type="submit" variant="contained" endIcon={<Send />} disabled={submitting || !formData.title.trim()} size="large">
              {submitting ? 'Submitting...' : 'Submit for Review'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}

export default ShowcaseSubmit;
