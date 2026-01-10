import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  Breadcrumbs,
  Grid,
  Divider
} from '@mui/material';
import {
  Send,
  ArrowBack,
  Lightbulb,
  TrendingUp,
  Extension,
  Api
} from '@mui/icons-material';
import api from '../../utils/api';

const categories = [
  { value: 'feature', label: 'New Feature', icon: <Lightbulb />, description: 'A completely new capability' },
  { value: 'improvement', label: 'Improvement', icon: <TrendingUp />, description: 'Enhance an existing feature' },
  { value: 'integration', label: 'Integration', icon: <Extension />, description: 'Connect with other services' },
  { value: 'api', label: 'API', icon: <Api />, description: 'API enhancements or changes' }
];

function FeatureRequestForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'feature'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.description.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await api.post('/api/roadmap/feature-requests', {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category
      });

      navigate('/feature-requests', {
        state: { message: 'Feature request submitted successfully!' }
      });
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.response?.data?.error || 'Failed to submit feature request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link to="/feature-requests" style={{ textDecoration: 'none', color: 'inherit' }}>
          Feature Requests
        </Link>
        <Typography color="text.primary">Submit Request</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Submit Feature Request
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Tell us what you'd like to see in our product
        </Typography>
      </Box>

      <Grid container spacing={4}>
        {/* Form */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              {/* Title */}
              <TextField
                fullWidth
                label="Title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Brief summary of your feature request"
                required
                sx={{ mb: 3 }}
                inputProps={{ maxLength: 255 }}
                helperText={`${formData.title.length}/255 characters`}
              />

              {/* Category */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  name="category"
                  value={formData.category}
                  label="Category"
                  onChange={handleChange}
                >
                  {categories.map(cat => (
                    <MenuItem key={cat.value} value={cat.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {cat.icon}
                        <Box>
                          <Typography variant="body2">{cat.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {cat.description}
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Description */}
              <TextField
                fullWidth
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe your feature request in detail. What problem does it solve? How would it work?"
                required
                multiline
                rows={8}
                sx={{ mb: 3 }}
              />

              <Divider sx={{ my: 3 }} />

              {/* Actions */}
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
                <Button
                  variant="outlined"
                  startIcon={<ArrowBack />}
                  component={Link}
                  to="/feature-requests"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  endIcon={<Send />}
                  disabled={submitting || !formData.title.trim() || !formData.description.trim()}
                  size="large"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Tips Sidebar */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Tips for a Great Request
              </Typography>
              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Be Specific
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Clearly describe what you want and why. The more specific, the better we can understand your needs.
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Explain the Problem
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  What problem are you trying to solve? Understanding the "why" helps us create better solutions.
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Provide Examples
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  If possible, include examples or use cases to illustrate how the feature would be used.
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Check for Duplicates
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Before submitting, check if a similar request exists. Vote for existing requests instead of creating duplicates.
                </Typography>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                What Happens Next?
              </Typography>
              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2">1. Submitted</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Your request is added to our queue
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">2. Reviewed</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Our team evaluates feasibility and impact
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">3. Planned</Typography>
                  <Typography variant="body2" color="text.secondary">
                    If approved, it's added to our roadmap
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">4. Built</Typography>
                  <Typography variant="body2" color="text.secondary">
                    We build and release the feature
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}

export default FeatureRequestForm;
