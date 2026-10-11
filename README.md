# TF-Agent

A Telegram bot that generates Amharic business ideas using AI (Google Gemini 2.5 Flash Lite) and posts them to the True Feed channel with owner approval.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your actual values:
   - `OPENROUTER_API_KEY` - OpenRouter API key
   - `TELEGRAM_BOT_TOKEN` - Telegram bot token
   - `OWNER_CHAT_ID` - Your Telegram ID (owner)
   - `TRUE_FEED_CHANNEL_ID` - Target channel ID
   - `MONGODB_URI` - MongoDB connection string
   - `PORT` - Server port (default: 3000)

3. Start the server:
   ```bash
   npm start
   # For development with auto-reload:
   npm run dev
   ```

4. Access dashboard at `http://localhost:3000`

## Usage

- **Generate Idea**: Use the Telegram bot to generate new business ideas
- **Approve/Reject**: Owner approves or rejects ideas before posting
- **Monitor**: View stats and history via web dashboard
- **Categories**: Automatically rotates through 6 business categories (physical, service, hybrid, eco, food, skills)