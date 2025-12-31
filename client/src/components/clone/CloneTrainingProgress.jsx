/**
 * CloneTrainingProgress Component
 * Displays training progress with steps and status
 */

import React from 'react';
import {
  Box, Typography, LinearProgress, Stepper, Step, StepLabel,
  StepContent, Paper, Chip, CircularProgress, Alert
} from '@mui/material';
import {
  Check as CheckIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon
} from '@mui/icons-material';

const trainingSteps = [
  {
    id: 'collecting',
    label: 'Collecting Data',
    description: 'Gathering training samples and preparing data'
  },
  {
    id: 'processing',
    label: 'Processing Content',
    description: 'Analyzing and extracting features from samples'
  },
  {
    id: 'extracting',
    label: 'Extracting Style',
    description: 'Identifying writing patterns and style markers'
  },
  {
    id: 'training',
    label: 'Training Model',
    description: 'Training the clone with processed data'
  },
  {
    id: 'validating',
    label: 'Validating Quality',
    description: 'Testing and validating clone responses'
  },
  {
    id: 'complete',
    label: 'Complete',
    description: 'Clone is ready to use'
  }
];

const CloneTrainingProgress = ({
  status = 'pending',
  progress = 0,
  currentStep = 'collecting',
  error = null,
  stats = {},
  onRetry,
  variant = 'full'
}) => {
  const getActiveStep = () => {
    const index = trainingSteps.findIndex(s => s.id === currentStep);
    return index >= 0 ? index : 0;
  };

  const getStepStatus = (stepIndex) => {
    const activeStep = getActiveStep();
    if (status === 'error' && stepIndex === activeStep) return 'error';
    if (stepIndex < activeStep) return 'completed';
    if (stepIndex === activeStep && status === 'training') return 'active';
    return 'pending';
  };

  const getStepIcon = (stepStatus) => {
    switch (stepStatus) {
      case 'completed':
        return <CheckIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'active':
        return <CircularProgress size={20} />;
      default:
        return <PendingIcon color="disabled" />;
    }
  };

  // Compact variant
  if (variant === 'compact') {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">
            {status === 'training'
              ? trainingSteps[getActiveStep()]?.label
              : status === 'complete'
              ? 'Training Complete'
              : 'Not Started'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {progress}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          color={status === 'error' ? 'error' : status === 'complete' ? 'success' : 'primary'}
        />
        {error && (
          <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
            {error}
          </Typography>
        )}
      </Box>
    );
  }

  // Progress bar variant
  if (variant === 'bar') {
    return (
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle2">
              {status === 'training'
                ? `Training: ${trainingSteps[getActiveStep()]?.label}`
                : status === 'complete'
                ? 'Training Complete'
                : 'Ready to Train'}
            </Typography>
          </Box>
          <Chip
            label={status}
            size="small"
            color={
              status === 'complete' ? 'success' :
              status === 'training' ? 'warning' :
              status === 'error' ? 'error' : 'default'
            }
          />
        </Box>

        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ height: 8, borderRadius: 4, mb: 1 }}
          color={status === 'error' ? 'error' : status === 'complete' ? 'success' : 'primary'}
        />

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            {trainingSteps[getActiveStep()]?.description}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {progress}%
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {stats && Object.keys(stats).length > 0 && (
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            {stats.samplesProcessed !== undefined && (
              <Box>
                <Typography variant="caption" color="text.secondary">Processed</Typography>
                <Typography variant="body2">{stats.samplesProcessed} samples</Typography>
              </Box>
            )}
            {stats.estimatedTime && (
              <Box>
                <Typography variant="caption" color="text.secondary">Est. Time</Typography>
                <Typography variant="body2">{stats.estimatedTime}</Typography>
              </Box>
            )}
            {stats.currentScore !== undefined && (
              <Box>
                <Typography variant="caption" color="text.secondary">Score</Typography>
                <Typography variant="body2">{stats.currentScore.toFixed(1)}</Typography>
              </Box>
            )}
          </Box>
        )}
      </Paper>
    );
  }

  // Full stepper variant
  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stepper activeStep={getActiveStep()} orientation="vertical">
        {trainingSteps.map((step, index) => {
          const stepStatus = getStepStatus(index);

          return (
            <Step key={step.id} completed={stepStatus === 'completed'}>
              <StepLabel
                error={stepStatus === 'error'}
                StepIconComponent={() => getStepIcon(stepStatus)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {step.label}
                  {stepStatus === 'active' && (
                    <Chip label="In Progress" size="small" color="warning" />
                  )}
                </Box>
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary">
                  {step.description}
                </Typography>
                {stepStatus === 'active' && (
                  <Box sx={{ mt: 1 }}>
                    <LinearProgress
                      variant="indeterminate"
                      sx={{ borderRadius: 1 }}
                    />
                  </Box>
                )}
              </StepContent>
            </Step>
          );
        })}
      </Stepper>

      {/* Stats Summary */}
      {stats && Object.keys(stats).length > 0 && (
        <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Training Stats</Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {stats.totalSamples !== undefined && (
              <Box>
                <Typography variant="caption" color="text.secondary">Total Samples</Typography>
                <Typography variant="body1">{stats.totalSamples}</Typography>
              </Box>
            )}
            {stats.processedSamples !== undefined && (
              <Box>
                <Typography variant="caption" color="text.secondary">Processed</Typography>
                <Typography variant="body1">{stats.processedSamples}</Typography>
              </Box>
            )}
            {stats.qualityScore !== undefined && (
              <Box>
                <Typography variant="caption" color="text.secondary">Quality Score</Typography>
                <Typography variant="body1">{stats.qualityScore.toFixed(1)}/5</Typography>
              </Box>
            )}
            {stats.duration && (
              <Box>
                <Typography variant="caption" color="text.secondary">Duration</Typography>
                <Typography variant="body1">{stats.duration}</Typography>
              </Box>
            )}
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default CloneTrainingProgress;
