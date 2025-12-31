/**
 * CloneCard Component
 * Displays a clone preview card with status and actions
 */

import React from 'react';
import {
  Card, CardContent, CardActions, Typography, Button, Box,
  Avatar, Chip, IconButton, Tooltip, LinearProgress, Menu, MenuItem
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  PlayArrow as PlayIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Share as ShareIcon,
  Analytics as AnalyticsIcon,
  Mic as MicIcon,
  Psychology as PsychologyIcon,
  Brush as StyleIcon
} from '@mui/icons-material';

const CloneCard = ({
  clone,
  onEdit,
  onDelete,
  onDuplicate,
  onShare,
  onTest,
  onViewAnalytics,
  variant = 'default'
}) => {
  const [anchorEl, setAnchorEl] = React.useState(null);

  const getStatusColor = (status) => {
    switch (status) {
      case 'ready': return 'success';
      case 'training': return 'warning';
      case 'draft': return 'default';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'voice': return <MicIcon />;
      case 'style': return <StyleIcon />;
      case 'personality': return <PsychologyIcon />;
      default: return null;
    }
  };

  const handleMenuOpen = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAction = (action) => {
    handleMenuClose();
    action?.();
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4
        }
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
          <Avatar
            src={clone.avatar_url}
            sx={{
              width: 48,
              height: 48,
              mr: 2,
              bgcolor: 'primary.main'
            }}
          >
            {clone.name?.[0]?.toUpperCase()}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {clone.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              <Chip
                label={clone.status || 'draft'}
                size="small"
                color={getStatusColor(clone.status)}
              />
              {clone.type && (
                <Chip
                  icon={getTypeIcon(clone.type)}
                  label={clone.type}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreIcon />
          </IconButton>
        </Box>

        {/* Description */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}
        >
          {clone.description || 'No description'}
        </Typography>

        {/* Training Progress */}
        {clone.status === 'training' && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption">Training...</Typography>
              <Typography variant="caption">{clone.training_progress || 0}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={clone.training_progress || 0}
            />
          </Box>
        )}

        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          {clone.training_score > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">Score</Typography>
              <Typography variant="body2" fontWeight="bold">
                {clone.training_score.toFixed(1)}
              </Typography>
            </Box>
          )}
          {clone.training_samples_count > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">Samples</Typography>
              <Typography variant="body2" fontWeight="bold">
                {clone.training_samples_count}
              </Typography>
            </Box>
          )}
          {clone.response_count > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">Responses</Typography>
              <Typography variant="body2" fontWeight="bold">
                {clone.response_count}
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        <Button
          size="small"
          startIcon={<EditIcon />}
          onClick={() => onEdit?.(clone)}
        >
          Edit
        </Button>
        {clone.status === 'ready' && (
          <Button
            size="small"
            variant="contained"
            startIcon={<PlayIcon />}
            onClick={() => onTest?.(clone)}
          >
            Test
          </Button>
        )}
      </CardActions>

      {/* More Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleAction(() => onEdit?.(clone))}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Edit
        </MenuItem>
        <MenuItem onClick={() => handleAction(() => onDuplicate?.(clone))}>
          <CopyIcon sx={{ mr: 1 }} fontSize="small" />
          Duplicate
        </MenuItem>
        <MenuItem onClick={() => handleAction(() => onShare?.(clone))}>
          <ShareIcon sx={{ mr: 1 }} fontSize="small" />
          Share
        </MenuItem>
        <MenuItem onClick={() => handleAction(() => onViewAnalytics?.(clone))}>
          <AnalyticsIcon sx={{ mr: 1 }} fontSize="small" />
          Analytics
        </MenuItem>
        <MenuItem
          onClick={() => handleAction(() => onDelete?.(clone))}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>
    </Card>
  );
};

export default CloneCard;
