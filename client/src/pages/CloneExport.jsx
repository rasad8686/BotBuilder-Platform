/**
 * Clone Export/Import Page
 * Export and import clone configurations
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, TextField,
  FormControlLabel, Checkbox, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Alert, Stepper, Step, StepLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, List,
  ListItem, ListItemText, ListItemIcon, Divider, Chip, Paper
} from '@mui/material';
import {
  Download as DownloadIcon,
  Upload as UploadIcon,
  FilePresent as FileIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  ArrowForward as ArrowIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';

const CloneExport = () => {
  const { cloneId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Export state
  const [clones, setClones] = useState([]);
  const [selectedClone, setSelectedClone] = useState(cloneId || '');
  const [exportFormat, setExportFormat] = useState('json');
  const [exportOptions, setExportOptions] = useState({
    includeTrainingData: true,
    includeResponses: false,
    responseLimit: 100
  });
  const [exporting, setExporting] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importOptions, setImportOptions] = useState({
    rename: true,
    includeTrainingData: true
  });
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState(0);

  // Common state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchClones();
  }, []);

  const fetchClones = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/clones');
      const data = await response.json();
      if (data.success) {
        setClones(data.clones);
      }
    } catch (err) {
      setError('Failed to load clones');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedClone) return;

    try {
      setExporting(true);
      setError(null);

      const response = await fetch(`/api/clones/${selectedClone}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: exportFormat,
          ...exportOptions
        })
      });

      if (exportFormat === 'zip') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clone-export-${selectedClone}.zip`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        if (data.success) {
          const blob = new Blob([JSON.stringify(data.data, null, 2)], {
            type: 'application/json'
          });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `clone-export-${selectedClone}.json`;
          a.click();
          window.URL.revokeObjectURL(url);
        } else {
          setError(data.error);
        }
      }

      setSuccess('Clone exported successfully');
    } catch (err) {
      setError('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImportFile(file);
    setImportStep(1);

    // Preview the import
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const response = await fetch('/api/clones/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const previewData = await response.json();
      if (previewData.success) {
        setImportPreview(previewData.preview);
        setImportStep(2);
      } else {
        setError(previewData.error);
        setImportStep(0);
      }
    } catch (err) {
      setError('Invalid file format');
      setImportStep(0);
    }
  };

  const handleImport = async () => {
    if (!importFile || !importPreview) return;

    try {
      setImporting(true);
      setError(null);

      const text = await importFile.text();
      const data = JSON.parse(text);

      const response = await fetch('/api/clones/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          options: importOptions
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(`Clone "${result.clone.name}" imported successfully`);
        setImportStep(3);
        fetchClones();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Import failed');
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setImportPreview(null);
    setImportStep(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Clone Export & Import</Typography>

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
        {/* Export Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <DownloadIcon sx={{ mr: 1 }} color="primary" />
                <Typography variant="h6">Export Clone</Typography>
              </Box>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Select Clone</InputLabel>
                <Select
                  value={selectedClone}
                  label="Select Clone"
                  onChange={(e) => setSelectedClone(e.target.value)}
                >
                  {clones.map((clone) => (
                    <MenuItem key={clone.id} value={clone.id}>
                      {clone.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Format</InputLabel>
                <Select
                  value={exportFormat}
                  label="Format"
                  onChange={(e) => setExportFormat(e.target.value)}
                >
                  <MenuItem value="json">JSON</MenuItem>
                  <MenuItem value="zip">ZIP (with assets)</MenuItem>
                </Select>
              </FormControl>

              <Typography variant="subtitle2" gutterBottom>Options</Typography>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={exportOptions.includeTrainingData}
                    onChange={(e) => setExportOptions({
                      ...exportOptions,
                      includeTrainingData: e.target.checked
                    })}
                  />
                }
                label="Include training data"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={exportOptions.includeResponses}
                    onChange={(e) => setExportOptions({
                      ...exportOptions,
                      includeResponses: e.target.checked
                    })}
                  />
                }
                label="Include response history"
              />

              {exportOptions.includeResponses && (
                <TextField
                  fullWidth
                  type="number"
                  label="Response limit"
                  value={exportOptions.responseLimit}
                  onChange={(e) => setExportOptions({
                    ...exportOptions,
                    responseLimit: parseInt(e.target.value)
                  })}
                  sx={{ mt: 1 }}
                />
              )}

              <Button
                fullWidth
                variant="contained"
                startIcon={exporting ? <CircularProgress size={20} /> : <DownloadIcon />}
                onClick={handleExport}
                disabled={!selectedClone || exporting}
                sx={{ mt: 3 }}
              >
                {exporting ? 'Exporting...' : 'Export Clone'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Import Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <UploadIcon sx={{ mr: 1 }} color="secondary" />
                <Typography variant="h6">Import Clone</Typography>
              </Box>

              <Stepper activeStep={importStep} sx={{ mb: 3 }}>
                <Step>
                  <StepLabel>Select File</StepLabel>
                </Step>
                <Step>
                  <StepLabel>Preview</StepLabel>
                </Step>
                <Step>
                  <StepLabel>Import</StepLabel>
                </Step>
              </Stepper>

              {importStep === 0 && (
                <Box>
                  <input
                    type="file"
                    accept=".json,.zip"
                    onChange={handleFileSelect}
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                  />
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<FileIcon />}
                    onClick={() => fileInputRef.current?.click()}
                    sx={{ py: 4 }}
                  >
                    Select export file (.json or .zip)
                  </Button>
                </Box>
              )}

              {importStep === 1 && (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <CircularProgress />
                  <Typography sx={{ mt: 2 }}>Analyzing file...</Typography>
                </Box>
              )}

              {importStep === 2 && importPreview && (
                <Box>
                  <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>Preview</Typography>
                    <List dense>
                      <ListItem>
                        <ListItemText primary="Name" secondary={importPreview.name} />
                      </ListItem>
                      <ListItem>
                        <ListItemText primary="Description" secondary={importPreview.description || 'N/A'} />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Training Data"
                          secondary={`${importPreview.trainingDataCount} samples`}
                        />
                      </ListItem>
                      {importPreview.hasResponses && (
                        <ListItem>
                          <ListItemText
                            primary="Responses"
                            secondary={`${importPreview.responsesCount} responses`}
                          />
                        </ListItem>
                      )}
                    </List>
                  </Paper>

                  <Typography variant="subtitle2" gutterBottom>Import Options</Typography>

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={importOptions.rename}
                        onChange={(e) => setImportOptions({
                          ...importOptions,
                          rename: e.target.checked
                        })}
                      />
                    }
                    label="Rename if name exists"
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={importOptions.includeTrainingData}
                        onChange={(e) => setImportOptions({
                          ...importOptions,
                          includeTrainingData: e.target.checked
                        })}
                      />
                    }
                    label="Include training data"
                  />

                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button variant="outlined" onClick={resetImport}>
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={importing ? <CircularProgress size={20} /> : <UploadIcon />}
                      onClick={handleImport}
                      disabled={importing}
                    >
                      {importing ? 'Importing...' : 'Import Clone'}
                    </Button>
                  </Box>
                </Box>
              )}

              {importStep === 3 && (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <CheckIcon color="success" sx={{ fontSize: 48, mb: 2 }} />
                  <Typography variant="h6" gutterBottom>Import Complete!</Typography>
                  <Button
                    variant="contained"
                    startIcon={<RefreshIcon />}
                    onClick={resetImport}
                    sx={{ mr: 1 }}
                  >
                    Import Another
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/clones')}
                  >
                    View Clones
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Export History */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Recent Exports</Typography>
          <Typography variant="body2" color="text.secondary">
            Export history is stored locally. Clear your browser data to reset.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CloneExport;
