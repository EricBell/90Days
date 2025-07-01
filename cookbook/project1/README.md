# Claude Chat App

A minimal, real-time streaming chat application that connects to **Anthropic's Claude Sonnet 4** via **OpenRouter**. Features markdown rendering, code syntax highlighting, and session-based conversation context.

## Features

- 🚀 **Real-time streaming** - See Claude's responses as they're generated
- 📝 **Markdown support** - Full markdown rendering including code blocks
- 🎨 **Syntax highlighting** - Code blocks are automatically highlighted
- 💬 **Session context** - Maintains conversation history during your session
- ⚡ **Minimal setup** - Just a few files, ready to run
- 🔒 **Secure** - API key stored as environment variable

## Project Structure

```
project1/
├── package.json       # Project dependencies and scripts
├── index.js           # Express server + OpenRouter integration
├── public/
│   ├── index.html     # Clean, responsive UI
│   └── client.js      # Real-time streaming client logic
└── README.md          # This file
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

This installs:
- `express` - Web server framework
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variable loader

### 2. Set Your OpenRouter API Key

Create a `.env` file in the project root:

```bash
OPENROUTER_API_KEY=your_api_key_here
```

**To get an OpenRouter API key:**
1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Go to your dashboard
3. Generate a new API key
4. Copy it to your `.env` file

### 3. Start the Server

```bash
npm start
```

You should see:
```
🚀 Claude chat app running on http://localhost:3000
Make sure to set your OPENROUTER_API_KEY environment variable!
```

### 4. Open in Browser

Navigate to **http://localhost:3000** in your web browser.

## How It Works

### Server Side (`index.js`)

- **Express server** with CORS enabled
- **Two main endpoints**:
  - `GET /stream?sessionId=...` - Server-Sent Events for real-time updates
  - `POST /chat` - Processes messages and streams responses
- **In-memory session storage** - Keeps conversation context per session
- **OpenRouter integration** - Calls Claude Sonnet 4 with streaming enabled

### Client Side (`public/`)

- **`index.html`** - Clean, responsive interface with markdown styling
- **`client.js`** - Handles:
  - Session management (localStorage)
  - Real-time streaming via Server-Sent Events
  - Markdown rendering with [marked.js](https://marked.js.org/)
  - Code syntax highlighting with [highlight.js](https://highlightjs.org/)

### Session Management

- Each browser generates a unique session ID
- Conversation history is maintained server-side per session
- Sessions are temporary (lost on server restart)

## API Usage

The app uses OpenRouter's chat completions endpoint:

```javascript
POST https://openrouter.ai/api/v1/chat/completions
{
  "model": "anthropic/claude-3.5-sonnet",
  "messages": [...conversation_history],
  "stream": true,
  "max_tokens": 4000
}
```

## Development

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | Your OpenRouter API key |
| `PORT` | No | Server port (default: 3000) |

### File Overview

- **`package.json`** - Dependencies: express, cors, dotenv
- **`index.js`** - Server with SSE streaming and OpenRouter integration
- **`public/index.html`** - UI with markdown styling and responsive design
- **`public/client.js`** - Client-side streaming, session management, markdown rendering

### Customization

- **Model**: Change `anthropic/claude-3.5-sonnet` to any OpenRouter-supported model
- **Styling**: Modify CSS in `index.html`
- **Max tokens**: Adjust in the API call (currently 4000)
- **Port**: Set `PORT` environment variable

## Security Notes

- API key is stored as environment variable (never in code)
- No authentication system (suitable for local development)
- Sessions are temporary and stored in memory only
- Input is sanitized to prevent XSS attacks

## Troubleshooting

### "No SSE connection found"
- Make sure browser is connected to `/stream` endpoint
- Check browser console for connection errors

### "OpenRouter API error"
- Verify your API key is correct in `.env`
- Check you have credits in your OpenRouter account
- Ensure the model name is correct

### Streaming not working
- Check browser supports Server-Sent Events
- Verify CORS is properly configured
- Look for JavaScript errors in browser console

## License

MIT License - feel free to modify and use for your projects!
