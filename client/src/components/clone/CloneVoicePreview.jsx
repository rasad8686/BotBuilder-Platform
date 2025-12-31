/**
 * CloneVoicePreview Component
 * Voice sample player and preview for voice clones
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, IconButton, Slider, Paper, Button, TextField,
  CircularProgress, Alert, Chip, LinearProgress, Tooltip
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  VolumeUp as VolumeIcon,
  VolumeOff as MuteIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Mic as MicIcon,
  GraphicEq as WaveformIcon
} from '@mui/icons-material';

const CloneVoicePreview = ({
  cloneId,
  voiceId,
  samples = [],
  onSynthesize,
  synthesizing = false,
  audioUrl,
  disabled = false
}) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedSample, setSelectedSample] = useState(null);
  const [testText, setTestText] = useState('Hello, this is a test of my voice clone.');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }
  }, [audioUrl]);

  const handlePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (event, newValue) => {
    if (audioRef.current) {
      audioRef.current.currentTime = newValue;
      setCurrentTime(newValue);
    }
  };

  const handleVolumeChange = (event, newValue) => {
    setVolume(newValue);
    setIsMuted(newValue === 0);
  };

  const handleSynthesize = async () => {
    if (!testText.trim()) return;

    try {
      setError(null);
      await onSynthesize?.(testText);
    } catch (err) {
      setError(err.message);
    }
  };

  const formatTime = (time) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = 'voice-preview.mp3';
      a.click();
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Voice Samples List */}
      {samples.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Voice Samples ({samples.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {samples.map((sample, index) => (
              <Chip
                key={sample.id || index}
                icon={<MicIcon />}
                label={sample.name || `Sample ${index + 1}`}
                onClick={() => setSelectedSample(sample)}
                variant={selectedSample?.id === sample.id ? 'filled' : 'outlined'}
                color={selectedSample?.id === sample.id ? 'primary' : 'default'}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Audio Player */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          onError={() => setError('Failed to load audio')}
        />

        {/* Waveform Visualization Placeholder */}
        <Box
          sx={{
            height: 60,
            bgcolor: 'grey.100',
            borderRadius: 1,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          {audioUrl ? (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-end', height: 40 }}>
              {[...Array(30)].map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 4,
                    height: `${Math.random() * 100}%`,
                    bgcolor: isPlaying ? 'primary.main' : 'grey.400',
                    borderRadius: 1,
                    transition: 'background-color 0.2s'
                  }}
                />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              <WaveformIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              No audio loaded
            </Typography>
          )}
        </Box>

        {/* Progress Slider */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ width: 40 }}>
            {formatTime(currentTime)}
          </Typography>
          <Slider
            value={currentTime}
            max={duration || 100}
            onChange={handleSeek}
            disabled={!audioUrl}
            sx={{ flexGrow: 1 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ width: 40 }}>
            {formatTime(duration)}
          </Typography>
        </Box>

        {/* Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              onClick={handleStop}
              disabled={!audioUrl}
            >
              <StopIcon />
            </IconButton>
            <IconButton
              onClick={handlePlay}
              disabled={!audioUrl}
              color="primary"
              sx={{ bgcolor: 'primary.light', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: 150 }}>
            <IconButton onClick={() => setIsMuted(!isMuted)} size="small">
              {isMuted ? <MuteIcon /> : <VolumeIcon />}
            </IconButton>
            <Slider
              value={isMuted ? 0 : volume}
              max={1}
              step={0.1}
              onChange={handleVolumeChange}
              size="small"
            />
          </Box>

          <Tooltip title="Download">
            <IconButton onClick={handleDownload} disabled={!audioUrl}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* Text to Speech Test */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Test Voice
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={3}
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Enter text to synthesize..."
          disabled={disabled || synthesizing}
          sx={{ mb: 2 }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {testText.length} / 500 characters
          </Typography>
          <Button
            variant="contained"
            onClick={handleSynthesize}
            disabled={disabled || synthesizing || !testText.trim() || testText.length > 500}
            startIcon={synthesizing ? <CircularProgress size={20} /> : <PlayIcon />}
          >
            {synthesizing ? 'Synthesizing...' : 'Synthesize'}
          </Button>
        </Box>

        {synthesizing && (
          <LinearProgress sx={{ mt: 2 }} />
        )}
      </Paper>
    </Box>
  );
};

export default CloneVoicePreview;
