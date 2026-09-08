# TF Agent - Telegram Serverless Bot

A Telegram bot for generating Amharic business ideas, deployed on Telegram Serverless infrastructure.

## Features

- Generates Amharic business ideas using Google Gemini AI
- Approve/reject workflow for content moderation
- Automatic posting to True Feed channel
- Persistent SQLite database for idea tracking
- Category rotation (physical, service, digital, eco, food, skills)

## Deployment

This bot is designed for Telegram Serverless. To deploy:

1. **Enable Serverless for your bot** in @BotFather
2. **Get CLI access token** from BotFather → Serverless → CLI Access
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Login to Telegram Serverless**:
   ```bash
   npx tgcloud login
   ```
5. **Deploy code**:
   ```bash
   npm run deploy
   ```
6. **Run database migrations**:
   ```bash
   npm run migrate
   ```

## Environment Variables

Configure these in your Telegram Serverless bot settings (BotFather → your bot → Serverless → Environment Variables):

- `GEMINI_API_KEY`: Google Generative AI API key (required)
- `TRUE_FEED_CHANNEL_ID`: Telegram channel ID for posting approved ideas (required) - Your channel: `2379106699`
- `OWNER_CHAT_ID`: Restrict bot access to specific Telegram user ID (optional) - Your ID: `685669468`

## Usage

1. Send `/start` to your bot
2. Click "አዲስ ሀሳብ ስጠኝ" to generate a new business idea
3. Review the generated idea
4. Click "✅ Approve & Post" to publish to True Feed channel
5. Click "❌ Reject — New Idea" to discard and generate another

## Commands

```bash
npm run deploy    # Deploy code to Telegram Serverless
npm run migrate   # Run database migrations
npm run status    # Check deployment status
npm run diff      # View changes before deploying
```

## Architecture

- **Handlers**: `handlers/message.js` and `handlers/callback_query.js` process Telegram updates
- **Libraries**: `lib/gemini.js` (AI integration) and `lib/prompts.js` (prompt building)
- **Database**: SQLite with schema defined in `schema.js`
- **SDK**: Uses Telegram Serverless SDK for API, database, and HTTP operations

## Tech Stack

- Telegram Serverless (V8 sandbox)
- SQLite (built-in database)
- Google Gemini API (via HTTP)
- ES Modules
