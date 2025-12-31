/**
 * ClonePersonalitySliders Component
 * Personality trait configuration with visual sliders
 */

import React, { useState } from 'react';
import {
  Box, Typography, Slider, Paper, Grid, Chip, Tooltip,
  IconButton, Collapse, Button
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Refresh as ResetIcon,
  Info as InfoIcon
} from '@mui/icons-material';

const personalityTraits = {
  core: [
    {
      id: 'openness',
      label: 'Openness',
      leftLabel: 'Traditional',
      rightLabel: 'Creative',
      description: 'Willingness to explore new ideas and approaches'
    },
    {
      id: 'conscientiousness',
      label: 'Conscientiousness',
      leftLabel: 'Flexible',
      rightLabel: 'Organized',
      description: 'Level of organization and attention to detail'
    },
    {
      id: 'extraversion',
      label: 'Extraversion',
      leftLabel: 'Reserved',
      rightLabel: 'Outgoing',
      description: 'Energy level and social engagement style'
    },
    {
      id: 'agreeableness',
      label: 'Agreeableness',
      leftLabel: 'Direct',
      rightLabel: 'Accommodating',
      description: 'Tendency to be cooperative and pleasant'
    },
    {
      id: 'neuroticism',
      label: 'Emotional Stability',
      leftLabel: 'Sensitive',
      rightLabel: 'Resilient',
      description: 'Emotional stability and stress response'
    }
  ],
  communication: [
    {
      id: 'humor',
      label: 'Humor',
      leftLabel: 'Serious',
      rightLabel: 'Playful',
      description: 'Use of humor and light-heartedness'
    },
    {
      id: 'enthusiasm',
      label: 'Enthusiasm',
      leftLabel: 'Calm',
      rightLabel: 'Energetic',
      description: 'Level of excitement and energy in responses'
    },
    {
      id: 'patience',
      label: 'Patience',
      leftLabel: 'Quick',
      rightLabel: 'Thorough',
      description: 'Willingness to explain and repeat'
    },
    {
      id: 'directness',
      label: 'Directness',
      leftLabel: 'Diplomatic',
      rightLabel: 'Straightforward',
      description: 'How directly issues are addressed'
    }
  ],
  expertise: [
    {
      id: 'confidence',
      label: 'Confidence',
      leftLabel: 'Humble',
      rightLabel: 'Authoritative',
      description: 'Level of certainty in statements'
    },
    {
      id: 'curiosity',
      label: 'Curiosity',
      leftLabel: 'Task-focused',
      rightLabel: 'Inquisitive',
      description: 'Interest in learning more context'
    },
    {
      id: 'helpfulness',
      label: 'Helpfulness',
      leftLabel: 'Minimal',
      rightLabel: 'Proactive',
      description: 'Tendency to offer additional help'
    }
  ]
};

const defaultValues = Object.values(personalityTraits)
  .flat()
  .reduce((acc, trait) => ({ ...acc, [trait.id]: 0.5 }), {});

const ClonePersonalitySliders = ({
  values = defaultValues,
  onChange,
  disabled = false,
  showAdvanced = false
}) => {
  const [expanded, setExpanded] = useState({
    core: true,
    communication: showAdvanced,
    expertise: showAdvanced
  });

  const handleChange = (traitId, value) => {
    const newValues = { ...values, [traitId]: value };
    onChange?.(newValues);
  };

  const handleReset = () => {
    onChange?.(defaultValues);
  };

  const getTraitDescription = (value) => {
    if (value < 0.3) return 'Low';
    if (value < 0.7) return 'Moderate';
    return 'High';
  };

  const TraitSlider = ({ trait }) => {
    const value = values[trait.id] ?? 0.5;

    return (
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" fontWeight="medium">
              {trait.label}
            </Typography>
            <Tooltip title={trait.description}>
              <InfoIcon fontSize="small" color="action" sx={{ cursor: 'help' }} />
            </Tooltip>
          </Box>
          <Chip
            label={getTraitDescription(value)}
            size="small"
            color={value < 0.3 ? 'default' : value > 0.7 ? 'primary' : 'default'}
            variant={value >= 0.3 && value <= 0.7 ? 'outlined' : 'filled'}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ width: 80, textAlign: 'right' }}>
            {trait.leftLabel}
          </Typography>
          <Slider
            value={value}
            min={0}
            max={1}
            step={0.05}
            onChange={(e, v) => handleChange(trait.id, v)}
            disabled={disabled}
            sx={{ flexGrow: 1 }}
            marks={[
              { value: 0 },
              { value: 0.25 },
              { value: 0.5 },
              { value: 0.75 },
              { value: 1 }
            ]}
          />
          <Typography variant="caption" color="text.secondary" sx={{ width: 80 }}>
            {trait.rightLabel}
          </Typography>
        </Box>
      </Box>
    );
  };

  const TraitSection = ({ title, icon, traits, sectionKey }) => (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' }
        }}
        onClick={() => setExpanded(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon}
          <Typography variant="subtitle1">{title}</Typography>
          <Chip label={`${traits.length} traits`} size="small" variant="outlined" />
        </Box>
        <IconButton size="small">
          {expanded[sectionKey] ? <CollapseIcon /> : <ExpandIcon />}
        </IconButton>
      </Box>
      <Collapse in={expanded[sectionKey]}>
        <Box sx={{ p: 2, pt: 0 }}>
          {traits.map(trait => (
            <TraitSlider key={trait.id} trait={trait} />
          ))}
        </Box>
      </Collapse>
    </Paper>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          <PsychologyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Personality Traits
        </Typography>
        <Button
          size="small"
          startIcon={<ResetIcon />}
          onClick={handleReset}
          disabled={disabled}
        >
          Reset to Defaults
        </Button>
      </Box>

      <TraitSection
        title="Core Personality"
        icon={<PsychologyIcon color="primary" />}
        traits={personalityTraits.core}
        sectionKey="core"
      />

      <TraitSection
        title="Communication Style"
        icon={<PsychologyIcon color="secondary" />}
        traits={personalityTraits.communication}
        sectionKey="communication"
      />

      <TraitSection
        title="Expertise & Approach"
        icon={<PsychologyIcon color="info" />}
        traits={personalityTraits.expertise}
        sectionKey="expertise"
      />

      {/* Summary */}
      <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Typography variant="subtitle2" gutterBottom>Personality Summary</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {Object.entries(values)
            .filter(([_, v]) => v > 0.7 || v < 0.3)
            .slice(0, 6)
            .map(([id, value]) => {
              const trait = Object.values(personalityTraits)
                .flat()
                .find(t => t.id === id);
              if (!trait) return null;

              return (
                <Chip
                  key={id}
                  label={`${value < 0.3 ? trait.leftLabel : trait.rightLabel}`}
                  size="small"
                  color={value > 0.7 ? 'primary' : 'default'}
                  variant={value < 0.3 ? 'outlined' : 'filled'}
                />
              );
            })}
          {Object.entries(values).filter(([_, v]) => v > 0.7 || v < 0.3).length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Balanced personality - adjust sliders to define distinctive traits
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default ClonePersonalitySliders;
