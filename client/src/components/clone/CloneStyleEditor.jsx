/**
 * CloneStyleEditor Component
 * Writing style configuration editor
 */

import React, { useState } from 'react';
import {
  Box, Typography, Slider, Paper, TextField, Chip, Button,
  FormControl, InputLabel, Select, MenuItem, Grid, Divider,
  Accordion, AccordionSummary, AccordionDetails, IconButton, Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Preview as PreviewIcon
} from '@mui/icons-material';

const defaultToneSettings = {
  formality: 0.5,
  friendliness: 0.5,
  assertiveness: 0.5,
  empathy: 0.5,
  creativity: 0.5,
  conciseness: 0.5
};

const CloneStyleEditor = ({
  styleProfile = {},
  toneSettings = defaultToneSettings,
  vocabularyPreferences = {},
  onChange,
  onPreview,
  disabled = false
}) => {
  const [localTone, setLocalTone] = useState(toneSettings);
  const [localVocab, setLocalVocab] = useState(vocabularyPreferences);
  const [customPhrases, setCustomPhrases] = useState(styleProfile.customPhrases || []);
  const [avoidPhrases, setAvoidPhrases] = useState(styleProfile.avoidPhrases || []);
  const [newCustomPhrase, setNewCustomPhrase] = useState('');
  const [newAvoidPhrase, setNewAvoidPhrase] = useState('');

  const handleToneChange = (key, value) => {
    const newTone = { ...localTone, [key]: value };
    setLocalTone(newTone);
    onChange?.({ toneSettings: newTone });
  };

  const handleVocabChange = (key, value) => {
    const newVocab = { ...localVocab, [key]: value };
    setLocalVocab(newVocab);
    onChange?.({ vocabularyPreferences: newVocab });
  };

  const addCustomPhrase = () => {
    if (newCustomPhrase.trim()) {
      const updated = [...customPhrases, newCustomPhrase.trim()];
      setCustomPhrases(updated);
      setNewCustomPhrase('');
      onChange?.({ styleProfile: { ...styleProfile, customPhrases: updated } });
    }
  };

  const removeCustomPhrase = (index) => {
    const updated = customPhrases.filter((_, i) => i !== index);
    setCustomPhrases(updated);
    onChange?.({ styleProfile: { ...styleProfile, customPhrases: updated } });
  };

  const addAvoidPhrase = () => {
    if (newAvoidPhrase.trim()) {
      const updated = [...avoidPhrases, newAvoidPhrase.trim()];
      setAvoidPhrases(updated);
      setNewAvoidPhrase('');
      onChange?.({ styleProfile: { ...styleProfile, avoidPhrases: updated } });
    }
  };

  const removeAvoidPhrase = (index) => {
    const updated = avoidPhrases.filter((_, i) => i !== index);
    setAvoidPhrases(updated);
    onChange?.({ styleProfile: { ...styleProfile, avoidPhrases: updated } });
  };

  const ToneSlider = ({ label, value, description, onChange }) => (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {(value * 100).toFixed(0)}%
        </Typography>
      </Box>
      <Slider
        value={value}
        min={0}
        max={1}
        step={0.05}
        onChange={(e, v) => onChange(v)}
        disabled={disabled}
        marks={[
          { value: 0, label: 'Low' },
          { value: 0.5, label: 'Medium' },
          { value: 1, label: 'High' }
        ]}
      />
      <Typography variant="caption" color="text.secondary">
        {description}
      </Typography>
    </Box>
  );

  return (
    <Box>
      {/* Tone Settings */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandIcon />}>
          <Typography variant="subtitle1">Tone Settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <ToneSlider
                label="Formality"
                value={localTone.formality}
                description="How formal or casual the writing style is"
                onChange={(v) => handleToneChange('formality', v)}
              />
              <ToneSlider
                label="Friendliness"
                value={localTone.friendliness}
                description="How warm and approachable the tone is"
                onChange={(v) => handleToneChange('friendliness', v)}
              />
              <ToneSlider
                label="Assertiveness"
                value={localTone.assertiveness}
                description="How confident and direct the communication is"
                onChange={(v) => handleToneChange('assertiveness', v)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <ToneSlider
                label="Empathy"
                value={localTone.empathy}
                description="How understanding and supportive the responses are"
                onChange={(v) => handleToneChange('empathy', v)}
              />
              <ToneSlider
                label="Creativity"
                value={localTone.creativity}
                description="How creative and expressive the writing is"
                onChange={(v) => handleToneChange('creativity', v)}
              />
              <ToneSlider
                label="Conciseness"
                value={localTone.conciseness}
                description="How brief and to-the-point responses are"
                onChange={(v) => handleToneChange('conciseness', v)}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Vocabulary Preferences */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandIcon />}>
          <Typography variant="subtitle1">Vocabulary Preferences</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Complexity Level</InputLabel>
                <Select
                  value={localVocab.complexity || 'moderate'}
                  label="Complexity Level"
                  onChange={(e) => handleVocabChange('complexity', e.target.value)}
                  disabled={disabled}
                >
                  <MenuItem value="simple">Simple - Easy to understand</MenuItem>
                  <MenuItem value="moderate">Moderate - Standard vocabulary</MenuItem>
                  <MenuItem value="advanced">Advanced - Technical vocabulary</MenuItem>
                  <MenuItem value="expert">Expert - Industry-specific terms</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Sentence Length</InputLabel>
                <Select
                  value={localVocab.sentenceLength || 'medium'}
                  label="Sentence Length"
                  onChange={(e) => handleVocabChange('sentenceLength', e.target.value)}
                  disabled={disabled}
                >
                  <MenuItem value="short">Short - Brief sentences</MenuItem>
                  <MenuItem value="medium">Medium - Balanced length</MenuItem>
                  <MenuItem value="long">Long - Detailed sentences</MenuItem>
                  <MenuItem value="varied">Varied - Mix of lengths</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Use of Contractions</InputLabel>
                <Select
                  value={localVocab.contractions || 'sometimes'}
                  label="Use of Contractions"
                  onChange={(e) => handleVocabChange('contractions', e.target.value)}
                  disabled={disabled}
                >
                  <MenuItem value="never">Never - Always full words</MenuItem>
                  <MenuItem value="rarely">Rarely - Formal style</MenuItem>
                  <MenuItem value="sometimes">Sometimes - Natural mix</MenuItem>
                  <MenuItem value="often">Often - Casual style</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Use of Emojis</InputLabel>
                <Select
                  value={localVocab.emojis || 'never'}
                  label="Use of Emojis"
                  onChange={(e) => handleVocabChange('emojis', e.target.value)}
                  disabled={disabled}
                >
                  <MenuItem value="never">Never</MenuItem>
                  <MenuItem value="rarely">Rarely</MenuItem>
                  <MenuItem value="sometimes">Sometimes</MenuItem>
                  <MenuItem value="often">Often</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Custom Phrases */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandIcon />}>
          <Typography variant="subtitle1">Custom Phrases</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add signature phrases or expressions that should be used in responses.
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Add a custom phrase..."
              value={newCustomPhrase}
              onChange={(e) => setNewCustomPhrase(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCustomPhrase()}
              disabled={disabled}
            />
            <Button
              variant="contained"
              onClick={addCustomPhrase}
              disabled={disabled || !newCustomPhrase.trim()}
            >
              <AddIcon />
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {customPhrases.map((phrase, index) => (
              <Chip
                key={index}
                label={phrase}
                onDelete={() => removeCustomPhrase(index)}
                disabled={disabled}
              />
            ))}
            {customPhrases.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No custom phrases added
              </Typography>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Phrases to Avoid */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandIcon />}>
          <Typography variant="subtitle1">Phrases to Avoid</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add words or phrases that should be avoided in responses.
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Add a phrase to avoid..."
              value={newAvoidPhrase}
              onChange={(e) => setNewAvoidPhrase(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addAvoidPhrase()}
              disabled={disabled}
            />
            <Button
              variant="contained"
              color="error"
              onClick={addAvoidPhrase}
              disabled={disabled || !newAvoidPhrase.trim()}
            >
              <AddIcon />
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {avoidPhrases.map((phrase, index) => (
              <Chip
                key={index}
                label={phrase}
                color="error"
                variant="outlined"
                onDelete={() => removeAvoidPhrase(index)}
                disabled={disabled}
              />
            ))}
            {avoidPhrases.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No phrases to avoid added
              </Typography>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Preview Button */}
      {onPreview && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<PreviewIcon />}
            onClick={onPreview}
            disabled={disabled}
          >
            Preview Style
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default CloneStyleEditor;
