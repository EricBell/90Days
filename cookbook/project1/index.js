const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage for conversation sessions
// sessionId -> array of messages
const sessionStore = new Map();

// SSE connections storage
// sessionId -> response object
const sseConnections = new Map();

/**
 * GET /stream - Server-Sent Events endpoint for real-time updates
 * Keeps connection open to stream assistant responses
 */
app.get('/stream', (req, res) => {
  const sessionId = req.query.sessionId;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Store this connection for the session
  sseConnections.set(sessionId, res);

  // Send initial connection confirmation
  res.write('data: {"type": "connected"}\n\n');

  // Clean up on client disconnect
  req.on('close', () => {
    sseConnections.delete(sessionId);
  });
});

/**
 * POST /chat - Handle new chat messages
 * Processes user input and streams Claude's response
 */
app.post('/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message are required' });
    }

    // Initialize session if it doesn't exist
    if (!sessionStore.has(sessionId)) {
      sessionStore.set(sessionId, []);
    }

    // Get conversation history
    const messageHistory = sessionStore.get(sessionId);
    
    // Add user message to history
    messageHistory.push({
      role: 'user',
      content: message
    });

    // Get SSE connection for this session
    const sseRes = sseConnections.get(sessionId);
    
    if (!sseRes) {
      return res.status(400).json({ error: 'No SSE connection found for session' });
    }

    // Call OpenRouter API with streaming
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000', // Optional
        'X-Title': 'Claude Chat App' // Optional
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: messageHistory,
        stream: true,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    // Process the streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              // Stream finished - add complete message to history
              messageHistory.push({
                role: 'assistant',
                content: assistantMessage
              });
              
              // Send completion signal
              sseRes.write('data: {"type": "complete"}\n\n');
              break;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              
              if (content) {
                assistantMessage += content;
                
                // Stream this chunk to the client
                sseRes.write(`data: ${JSON.stringify({
                  type: 'chunk',
                  content: content
                })}\n\n`);
              }
            } catch (parseError) {
              console.log('Parse error (non-critical):', parseError.message);
            }
          }
        }
      }
    } catch (streamError) {
      console.error('Streaming error:', streamError);
      sseRes.write(`data: ${JSON.stringify({
        type: 'error',
        message: 'Streaming error occurred'
      })}\n\n`);
    }

    // Send success response to the original POST request
    res.json({ success: true });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Claude chat app running on http://localhost:${PORT}`);
  console.log('Make sure to set your OPENROUTER_API_KEY environment variable!');
});
