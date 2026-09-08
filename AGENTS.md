# TF Agent - Telegram Serverless Project

This is a Telegram Serverless bot for generating Amharic business ideas for the True Feed channel.

## Project Structure

```
tf-agent/
├── handlers/              # Telegram update handlers
│   ├── message.js       # Handles /start command and messages
│   └── callback_query.js # Handles button clicks (approve/reject)
├── lib/                 # Shared utility modules
│   ├── gemini.js        # Google Gemini AI integration via HTTP
│   └── prompts.js       # Prompt building logic
├── schema.js            # Database table definitions (SQLite)
├── package.json         # Project configuration
└── AGENTS.md            # This file
```

## Database Schema

The bot uses SQLite with a single table:

- `ideas`: Stores generated business ideas with fields:
  - `id`: Primary key (auto-increment)
  - `content`: Full Amharic business idea post
  - `topic`: Short topic name
  - `category`: Business category (physical, service, digital, eco, food, skills)
  - `status`: pending, posted, or rejected
  - `created_at`: Unix timestamp
  - `posted_at`: Unix timestamp (when posted)

## How It Works

1. User sends `/start` to the bot
2. Bot responds with "አዲስ ሀሳብ ስጠኝ" button
3. User clicks button → `callback_query` handler triggers
4. Bot fetches previous topics and determines next category
5. Bot calls Gemini API via HTTP to generate a new business idea
6. Idea is saved to database with status "pending"
7. Bot shows idea with "Approve & Post" and "Reject" buttons
8. If approved → posts to True Feed channel, marks as "posted"
9. If rejected → marks as "rejected", generates new idea automatically

## Environment Variables

Set these in your Telegram Serverless bot configuration (BotFather → your bot → Serverless → Environment Variables):

- `GEMINI_API_KEY`: Google Generative AI API key (required)
- `TRUE_FEED_CHANNEL_ID`: Telegram channel ID for posting approved ideas (required) - Current: `2379106699`
- `OWNER_CHAT_ID`: Restrict bot access to specific Telegram user ID (optional) - Current: `685669468`

## Deployment Commands

```bash
# Deploy code to Telegram Serverless
npm run deploy

# Run database migrations
npm run migrate

# Check deployment status
npm run status

# View changes before deploying
npm run diff
```

## Key Technical Details

- **ES Modules**: All files use `import/export` syntax
- **SDK Access**: Uses Telegram Serverless SDK (`api`, `db`, `http`, `sql`)
- **HTTP Requests**: Gemini API called via outbound HTTP (no SDK dependency)
- **No Web Server**: Pure event-driven, no Express or web endpoints
- **SQLite Database**: Uses Serverless's built-in SQLite with table DSL

## AI Assistant Notes

When modifying this project:

1. Keep all files as ES modules (`import/export`)
2. Use the Serverless SDK for database and API operations
3. Follow the handler pattern in `handlers/` directory
4. Place shared utilities in `lib/` directory
5. Database schema changes require migration after deployment
6. Always test locally with `npm run diff` before deploying
