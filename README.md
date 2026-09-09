# TF-Agent - True Feed Automation Bot

A Telegram bot for generating and posting Amharic business ideas to the True Feed channel. The bot uses AI to generate creative business ideas and provides an approval workflow via Telegram.

## Project Structure

```
TF-Agent/
├── server.js                 # Main Express server and API endpoints
├── package.json              # Project dependencies and scripts
├── .env                      # Environment variables (not committed)
├── .env.example              # Example environment variables template
├── README.md                 # Project documentation
├── public/
│   └── dashboard.html        # Web dashboard for tracking ideas
└── src/
    ├── agent.js              # AI idea generation logic
    ├── bot.js                # Telegram bot implementation
    ├── database.js           # MongoDB database operations
    └── prompts.js            # AI prompt templates
```

## Core Components

### `server.js`
- Express web server running on configurable port (default: 3000)
- Serves the True Feed Automation Dashboard
- Provides REST API endpoints:
  - `GET /` - Dashboard interface
  - `GET /api/ideas` - Fetch all ideas from database
  - `GET /api/stats` - Get idea statistics (total, posted, rejected, pending)

### `src/bot.js`
- Telegram bot implementation using Telegraf
- Owner-only authorization system
- Bot commands and interactions:
  - `/start` - Welcome message with idea generation button
  - `new_idea` - Generate new business idea using AI
  - `approve_{id}` - Approve idea and post to True Feed channel
  - `reject_{id}` - Reject idea and generate new one
  - Image upload support for approved ideas
- Session management for pending ideas

### `src/agent.js`
- AI-powered idea generation using OpenRouter API
- Integrates with Google Gemini 2.5 Flash Lite model
- Content validation:
  - Ensures proper Amharic formatting
  - Validates structure (🟢 title, Value section)
  - Checks for required ". . ." pauses
  - Prevents Ethiopian period (።) usage
  - Blocks "Digital" keyword (uses "Hybrid" instead)
- Topic extraction and category management

### `src/database.js`
- MongoDB integration using Mongoose
- Database operations:
  - `initDB()` - Initialize database connection
  - `saveIdea()` - Save new idea to database
  - `getPreviousTopics()` - Fetch previously used topics
  - `getNextCategory()` - Rotate through business categories
  - `markPosted()` - Mark idea as posted
  - `markRejected()` - Mark idea as rejected
  - `getAllIdeas()` - Fetch all ideas
  - `getStats()` - Get idea statistics
  - `getIdeaById()` - Fetch specific idea
  - `deleteLastIdea()` - Delete most recent idea

### `src/prompts.js`
- AI prompt templates for idea generation
- Format specification:
  - Amharic business ideas with Hybrid label
  - Value section (5+ lines of deep insights)
  - No "How" section
  - Limited ". . ." usage (2-3 times max)
  - Ethiopian period (።) prohibited
- Category rotation: physical, service, hybrid, eco, food, skills

### `public/dashboard.html`
- Web-based True Feed Automation Dashboard
- Real-time statistics display:
  - Total ideas generated
  - Posted ideas count
  - Rejected ideas count
  - Pending ideas count
- Ideas table with details:
  - Topic, category, status
  - Creation and posting timestamps
- Auto-refresh every 30 seconds

## Environment Variables

Required environment variables (see `.env.example`):

- `TELEGRAM_BOT_TOKEN` - Telegram bot API token
- `TRUE_FEED_CHANNEL_ID` - Target Telegram channel ID
- `OWNER_CHAT_ID` - Authorized user Telegram ID
- `OPENROUTER_API_KEY` - OpenRouter API key for AI
- `MONGODB_URI` - MongoDB connection string
- `PORT` - Server port (default: 3000)

## Installation & Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. Start the server:
   ```bash
   npm start
   # For development with auto-reload:
   npm run dev
   ```

4. Access dashboard at `http://localhost:3000`

## Features

- **AI-Powered Ideas**: Uses Google Gemini 2.5 Flash Lite for creative business idea generation
- **Amharic Content**: Specialized for Amharic language with proper formatting
- **Category Rotation**: Automatically cycles through 6 business categories
- **Approval Workflow**: Owner approval system before posting to channel
- **Image Support**: Optional image upload for approved ideas
- **Duplicate Prevention**: Tracks previous topics to avoid repetition
- **Real-time Dashboard**: Web interface for monitoring bot activity
- **Database Tracking**: MongoDB storage for all ideas and their status

## Business Categories

The bot rotates through these categories:
- Physical products
- Service-based businesses  
- Hybrid models
- Eco-friendly businesses
- Food & beverage
- Skills & education

## Note

Everything is working perfectly except the dashboard not tracking previous data. This has been addressed by fixing the API endpoints to properly await async database functions.