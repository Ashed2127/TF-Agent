# TF-Agent 🌱

A serverless Telegram Bot & Mini App for **True Feed** that scrapes global news across 10 categories, generates faithful Amharic translations using AI, and automatically publishes formatted content to Telegram channels.

## ✨ Features

### 📰 News & Translation
- **80+ reputable news sources** across 10 categories (Tech, Business, World, Startups, Science, Education, Research, Crypto, Entertainment, Sports)
- **AI-powered Amharic translation** using OpenRouter API (Gemini 2.5 Flash Lite)
- **Translation on demand** - Users can translate articles to Amharic before posting
- **Custom RSS sources** - Users can add their own news feeds
- **Smart formatting** with Amharic punctuation (`. . .` pauses) and HTML bolding

### 👥 User Modes
- **Guest Mode**: Browse and translate news without channel setup
- **User Mode**: Full posting capabilities with channel management
- **Owner Mode**: Admin features with dashboard and data export

### 🤖 AI Content Generation
- **Content Structure System**:
  - **Owner**: Fixed hardcoded structure (cannot be edited)
  - **User**: Custom structure support or default template
- **AI-powered business ideas** with category rotation
- **Automatic content generation** with user's custom structure

### 📊 Owner Dashboard
- **Owner-only access** protected by authentication
- **Real-time statistics**: Users, posts, active channels
- **Data export feature**: Download complete database as JSON
- **Live telemetry** with auto-refresh every 30 seconds
- **Analytics tables**: Creators, channels, recent posts

### ⚙️ Channel Management
- **Multi-channel support**: Main channel + test channel per user
- **Bot admin verification**: Automatic admin permission checks
- **Channel linking**: Easy channel setup via forward/username/link
- **Auto-post scheduling**: Automated content generation and posting

### 🌐 Global Features
- **Currency rates**: Ethiopian Birr to USD exchange rates
- **Crypto prices**: Bitcoin price tracking
- **Source attribution**: Configurable source link display
- **Punctuation options**: Dot punctuation toggle

## 🚀 Quickstart & Commands

This project runs on Telegram's serverless isolate platform via the `tgcloud` CLI.

```bash
# Check changes vs cloud
npx tgcloud status

# Deploy code and static dashboard to cloud
npx tgcloud push

# Apply database schema changes
npx tgcloud migrate

# Run and test a module server-side
npx tgcloud run handlers/message '{"text":"/start","from":{"id":12345}}'

# Check webhook status
npx tgcloud webhook
```

## 📁 Project Structure

```
tf-agent/
├── tgcloud/                    # Serverless code (deployed)
│   ├── schema.js              # Database schema (8 tables)
│   ├── handlers/              # Telegram update handlers
│   │   ├── message.js         # /start, text messages, onboarding
│   │   └── callback_query.js  # Button clicks, news, translation
│   ├── endpoints/             # Mini App API endpoints
│   │   ├── dashboard.js       # Owner dashboard stats
│   │   ├── autoPost.js        # Auto-post scheduling
│   │   └── exportData.js      # Data export (owner only)
│   └── lib/                   # Shared modules
│       ├── agent.js           # AI content generation
│       ├── database.js        # Database operations
│       ├── news.js            # News scraping & translation
│       ├── rates.js           # Currency/crypto rates
│       ├── channel.js         # Channel utilities
│       └── secrets.js         # API keys
├── dist/                       # Static files (deployed)
│   ├── index.html             # Owner dashboard (main page)
│   └── mini-app.html          # Mini App front-end
├── public/                     # Public static files
├── tgcloud.jsonc              # Project config
├── package.json               # npm scripts
└── README.md
```

## 🗄️ Database Schema

- **`ideas`** - Generated business ideas with status tracking
- **`users`** - User accounts with onboarding and settings
- **`user_channels`** - Multiple channels per user (main, test)
- **`posts`** - Published posts history
- **`custom_sources`** - User-defined RSS feeds
- **`content_structures`** - Custom AI content templates
- **`auto_post_schedules`** - Automated posting schedules
- **`pending_edits`** - Temporary storage for edited content

## 🔐 Configuration

**Environment Variables (.env):**
- `OPENROUTER_API_KEY` - OpenRouter API key for AI features
- `TRUE_FEED_CHANNEL_ID` - Main True Feed channel ID
- `TEST_CHANNEL_ID` - Test channel ID
- `GIPHY_API_KEY` - Giphy API key for images

**Owner Configuration:**
- Owner ID: `685669468` (hardcoded in multiple files)
- Owner has fixed content structure (cannot be edited)
- Owner-only dashboard access

## 📡 Deployment

1. **Login to Telegram Cloud:**
   ```bash
   npx tgcloud login
   ```

2. **Deploy changes:**
   ```bash
   npx tgcloud push
   ```

3. **Apply database migrations:**
   ```bash
   npx tgcloud migrate
   ```

**Mini App URL:** `https://app8909892200.tgcloud.ai/`

## 🧪 Testing

```bash
# Test message handler
npx tgcloud run handlers/message '{"text":"/start","from":{"id":12345}}'

# Test callback handler
npx tgcloud run handlers/callback_query '{"data":"get_news","from":{"id":12345}}'

# Test endpoint
npx tgcloud run endpoints/dashboard '{}' --ctx '{ initData: { user: { id: 685669468 } } }'
```

## 📚 User Guide

### For Content Creators (User Mode)
1. **Onboarding**: Join True Feed channel → Provide channel → Add bot as admin → Select categories
2. **Browse News**: Select category → Choose news source → Browse articles
3. **Translate**: Click "Translate to Amharic" to translate before posting
4. **Edit**: Edit translated content before posting
5. **Post**: Post to main channel or test channel
6. **Custom Structure**: Set custom content structure in Settings
7. **Auto-Post**: Schedule automated content generation

### For Guest Users
- Browse and translate news without channel setup
- No posting capabilities
- Can switch to User Mode anytime

### For Owner
- Access dashboard at Mini App URL
- View real-time statistics
- Export complete database as JSON
- View all users, channels, and posts
- Toggle dot punctuation for testing

## 🔧 Development

**Dependencies:**
- `@tgcloud/cli` - Telegram Cloud CLI for deployment
- `node_modules` - Local only (not deployed to serverless)

**Module Rules:**
- Import project modules with `.js` extension
- Import SDK by name (`import { db } from 'sdk'`)
- No filesystem or npm packages at runtime
- Only `sdk` and project modules available

## 📝 License

ISC

## 🤝 Contributing

This is a private project for True Feed. For questions or support, contact the owner.
