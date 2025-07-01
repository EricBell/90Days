/**
 * Claude Chat App - Client Side JavaScript
 * Handles real-time streaming chat with Claude via OpenRouter
 */

class ChatApp {
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.eventSource = null;
    this.isConnected = false;
    this.currentAssistantMessage = null;
    this.isStreaming = false;
    
    // DOM elements
    this.chatContainer = document.getElementById('chat');
    this.messageInput = document.getElementById('messageInput');
    this.sendButton = document.getElementById('sendButton');
    this.connectionStatus = document.getElementById('connectionStatus');
    
    // Configure marked.js for better markdown rendering
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        highlight: function(code, lang) {
          if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, { language: lang }).value;
            } catch (err) {
              console.warn('Highlight.js error:', err);
            }
          }
          return code;
        },
        breaks: true,
        gfm: true
      });
    }
    
    this.init();
  }

  /**
   * Initialize the chat app
   */
  init() {
    this.setupEventListeners();
    this.connectSSE();
    
    // Add welcome message
    this.addWelcomeMessage();
  }

  /**
   * Get or create a unique session ID for this browser session
   */
  getOrCreateSessionId() {
    let sessionId = localStorage.getItem('claudeSessionId');
    
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('claudeSessionId', sessionId);
    }
    
    return sessionId;
  }

  /**
   * Set up event listeners for user interactions
   */
  setupEventListeners() {
    // Send message on button click
    this.sendButton.addEventListener('click', () => this.sendMessage());
    
    // Send message on Enter key press
    this.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Enable/disable send button based on input
    this.messageInput.addEventListener('input', () => {
      const hasText = this.messageInput.value.trim().length > 0;
      this.sendButton.disabled = !hasText || !this.isConnected || this.isStreaming;
    });
  }

  /**
   * Connect to the Server-Sent Events stream
   */
  connectSSE() {
    this.updateConnectionStatus('Connecting...', false);
    
    // Close existing connection if any
    if (this.eventSource) {
      this.eventSource.close();
    }

    this.eventSource = new EventSource(`/stream?sessionId=${this.sessionId}`);

    this.eventSource.onopen = () => {
      console.log('SSE connection opened');
      this.isConnected = true;
      this.updateConnectionStatus('Connected', true);
      this.updateSendButtonState();
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleSSEMessage(data);
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      this.isConnected = false;
      this.updateConnectionStatus('Connection lost. Reconnecting...', false);
      this.updateSendButtonState();
      
      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (this.eventSource.readyState === EventSource.CLOSED) {
          this.connectSSE();
        }
      }, 3000);
    };
  }

  /**
   * Handle incoming Server-Sent Events messages
   */
  handleSSEMessage(data) {
    switch (data.type) {
      case 'connected':
        console.log('SSE stream established');
        break;
        
      case 'chunk':
        this.appendToAssistantMessage(data.content);
        break;
        
      case 'complete':
        this.finalizeAssistantMessage();
        break;
        
      case 'error':
        this.handleStreamError(data.message);
        break;
        
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  /**
   * Send a chat message
   */
  async sendMessage() {
    const message = this.messageInput.value.trim();
    
    if (!message || !this.isConnected || this.isStreaming) {
      return;
    }

    // Clear input and disable sending
    this.messageInput.value = '';
    this.isStreaming = true;
    this.updateSendButtonState();

    // Add user message to chat
    this.addMessage(message, 'user');

    // Prepare for assistant response
    this.prepareAssistantMessage();

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          message: message
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      this.handleStreamError('Failed to send message. Please try again.');
    }
  }

  /**
   * Add a message to the chat display
   */
  addMessage(content, role) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    if (role === 'user') {
      messageDiv.innerHTML = `<div class="message-content">${this.escapeHtml(content)}</div>`;
    } else {
      // For assistant messages, render as markdown
      const renderedContent = typeof marked !== 'undefined' 
        ? marked.parse(content) 
        : this.escapeHtml(content);
      messageDiv.innerHTML = `<div class="message-content">${renderedContent}</div>`;
    }
    
    this.chatContainer.appendChild(messageDiv);
    this.scrollToBottom();
    
    return messageDiv;
  }

  /**
   * Prepare a new assistant message bubble for streaming
   */
  prepareAssistantMessage() {
    this.currentAssistantMessage = document.createElement('div');
    this.currentAssistantMessage.className = 'message assistant-message';
    this.currentAssistantMessage.innerHTML = '<div class="message-content"></div>';
    
    this.chatContainer.appendChild(this.currentAssistantMessage);
    this.scrollToBottom();
  }

  /**
   * Append content to the current assistant message
   */
  appendToAssistantMessage(content) {
    if (!this.currentAssistantMessage) {
      this.prepareAssistantMessage();
    }

    const contentDiv = this.currentAssistantMessage.querySelector('.message-content');
    const currentContent = contentDiv.textContent || '';
    const newContent = currentContent + content;
    
    // Render the complete message as markdown
    if (typeof marked !== 'undefined') {
      contentDiv.innerHTML = marked.parse(newContent);
    } else {
      contentDiv.textContent = newContent;
    }
    
    this.scrollToBottom();
  }

  /**
   * Finalize the assistant message when streaming is complete
   */
  finalizeAssistantMessage() {
    this.currentAssistantMessage = null;
    this.isStreaming = false;
    this.updateSendButtonState();
    
    // Trigger syntax highlighting for any new code blocks
    if (typeof hljs !== 'undefined') {
      this.chatContainer.querySelectorAll('pre code').forEach((block) => {
        if (!block.dataset.highlighted) {
          hljs.highlightElement(block);
          block.dataset.highlighted = 'yes';
        }
      });
    }
  }

  /**
   * Handle streaming errors
   */
  handleStreamError(message) {
    console.error('Stream error:', message);
    
    // Remove any incomplete assistant message
    if (this.currentAssistantMessage) {
      this.currentAssistantMessage.remove();
      this.currentAssistantMessage = null;
    }
    
    // Add error message
    this.addMessage(`❌ Error: ${message}`, 'assistant');
    
    this.isStreaming = false;
    this.updateSendButtonState();
  }

  /**
   * Add a welcome message when the app loads
   */
  addWelcomeMessage() {
    const welcomeMessage = `# Welcome to Claude Chat! 👋

I'm Claude, an AI assistant created by Anthropic. I'm here to help with:

- **Coding & Programming** - Debug code, explain concepts, write functions
- **Writing & Analysis** - Essays, emails, research, and creative writing  
- **Problem Solving** - Math, logic puzzles, strategic thinking
- **Learning Support** - Explanations, tutorials, Q&A on any topic

Feel free to ask me anything! I can format responses with **markdown**, including \`code snippets\` and:

\`\`\`javascript
// Even syntax-highlighted code blocks!
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

What would you like to chat about?`;

    this.addMessage(welcomeMessage, 'assistant');
  }

  /**
   * Update connection status display
   */
  updateConnectionStatus(message, connected) {
    this.connectionStatus.innerHTML = `<span class="${connected ? 'connected' : 'disconnected'}">${message}</span>`;
  }

  /**
   * Update send button state based on current conditions
   */
  updateSendButtonState() {
    const hasText = this.messageInput.value.trim().length > 0;
    this.sendButton.disabled = !hasText || !this.isConnected || this.isStreaming;
    
    if (this.isStreaming) {
      this.sendButton.textContent = 'Streaming...';
    } else {
      this.sendButton.textContent = 'Send';
    }
  }

  /**
   * Scroll chat to bottom
   */
  scrollToBottom() {
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Initialize the chat app when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new ChatApp();
});
