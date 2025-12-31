/**
 * CloneTestChat Component
 * Test conversation interface for clones
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Paper, TextField, IconButton, Typography, Avatar,
  CircularProgress, Chip, Divider, Button, Alert, Tooltip
} from '@mui/material';
import {
  Send as SendIcon,
  Refresh as RefreshIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  ContentCopy as CopyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Star as StarIcon
} from '@mui/icons-material';

const CloneTestChat = ({
  cloneId,
  cloneName = 'Clone',
  cloneAvatar,
  onSendMessage,
  onRateResponse,
  disabled = false,
  maxMessages = 50
}) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || disabled) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev.slice(-maxMessages + 1), userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await onSendMessage?.(inputValue.trim(), messages);

      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response?.response || response?.text || 'No response received',
        timestamp: new Date(),
        responseId: response?.responseId,
        tokens: response?.tokens,
        latencyMs: response?.latencyMs,
        similarity: response?.similarity
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError(err.message || 'Failed to get response');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRate = async (messageId, rating) => {
    const message = messages.find(m => m.id === messageId);
    if (!message?.responseId) return;

    try {
      await onRateResponse?.(message.responseId, rating);
      setMessages(prev =>
        prev.map(m =>
          m.id === messageId ? { ...m, rating } : m
        )
      );
    } catch (err) {
      setError('Failed to save rating');
    }
  };

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content);
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
  };

  const Message = ({ message }) => {
    const isUser = message.role === 'user';

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: isUser ? 'row-reverse' : 'row',
          gap: 1,
          mb: 2
        }}
      >
        <Avatar
          src={isUser ? undefined : cloneAvatar}
          sx={{
            width: 36,
            height: 36,
            bgcolor: isUser ? 'primary.main' : 'secondary.main'
          }}
        >
          {isUser ? 'U' : cloneName[0]}
        </Avatar>

        <Box sx={{ maxWidth: '75%' }}>
          <Paper
            elevation={1}
            sx={{
              p: 2,
              bgcolor: isUser ? 'primary.light' : 'grey.100',
              borderRadius: 2,
              borderTopRightRadius: isUser ? 0 : 2,
              borderTopLeftRadius: isUser ? 2 : 0
            }}
          >
            <Typography
              variant="body1"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {message.content}
            </Typography>
          </Paper>

          {/* Message metadata and actions */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mt: 0.5,
              justifyContent: isUser ? 'flex-end' : 'flex-start'
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {new Date(message.timestamp).toLocaleTimeString()}
            </Typography>

            {!isUser && (
              <>
                {message.latencyMs && (
                  <Chip label={`${message.latencyMs}ms`} size="small" variant="outlined" />
                )}
                {message.similarity && (
                  <Chip
                    label={`${(message.similarity * 100).toFixed(0)}% match`}
                    size="small"
                    color={message.similarity > 0.8 ? 'success' : 'default'}
                    variant="outlined"
                  />
                )}

                <Tooltip title="Copy">
                  <IconButton size="small" onClick={() => handleCopy(message.content)}>
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                {message.responseId && (
                  <>
                    <Tooltip title={message.rating === 5 ? 'Liked' : 'Like'}>
                      <IconButton
                        size="small"
                        onClick={() => handleRate(message.id, 5)}
                        color={message.rating === 5 ? 'success' : 'default'}
                      >
                        <ThumbUpIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={message.rating === 1 ? 'Disliked' : 'Dislike'}>
                      <IconButton
                        size="small"
                        onClick={() => handleRate(message.id, 1)}
                        color={message.rating === 1 ? 'error' : 'default'}
                      >
                        <ThumbDownIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </>
            )}
          </Box>
        </Box>
      </Box>
    );
  };

  return (
    <Paper
      elevation={2}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 400,
        maxHeight: 600
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar src={cloneAvatar} sx={{ width: 32, height: 32 }}>
            {cloneName[0]}
          </Avatar>
          <Typography variant="subtitle1">{cloneName}</Typography>
          <Chip label="Test Mode" size="small" color="warning" />
        </Box>
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={handleClear}
          disabled={messages.length === 0}
        >
          Clear
        </Button>
      </Box>

      {/* Messages */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: 2
        }}
      >
        {messages.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              Start a conversation to test your clone
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Messages are not saved between sessions
            </Typography>
          </Box>
        )}

        {messages.map(message => (
          <Message key={message.id} message={message} />
        ))}

        {isLoading && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'secondary.main' }}>
              {cloneName[0]}
            </Avatar>
            <Paper sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 2, borderTopLeftRadius: 0 }}>
              <CircularProgress size={20} />
            </Paper>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mx: 2, mb: 1 }}>
          {error}
        </Alert>
      )}

      {/* Input */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={disabled || isLoading}
            inputRef={inputRef}
            size="small"
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={disabled || isLoading || !inputValue.trim()}
          >
            {isLoading ? <CircularProgress size={24} /> : <SendIcon />}
          </IconButton>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          Press Enter to send, Shift+Enter for new line
        </Typography>
      </Box>
    </Paper>
  );
};

export default CloneTestChat;
