# TF-Agent

Telegram Mini App bot for True Feed that enables users to generate and post AI-curated news content to their Telegram channels. Built on Telegram's serverless platform (tgcloud).

## Features

### For Users (Public Access)
- **AI News Curation**: Browse news from 30+ tech sources and generate Amharic content with Ethiopian context
- **Simple Onboarding**: Only requires channel username to get started
- **Edit Content**: Edit news articles before posting to channels
- **Multiple Posting Options**: Post to main channel or test channel (if configured)
- **Customization**: Set bot display name, toggle source links, choose punctuation style
- **Category Selection**: Choose content categories (tech, entertainment, education, beauty, joke, fact)
- **Custom Sources**: Add custom RSS feed sources
- **User Dashboard**: View personal stats and post history via Mini App

### For Owner (Admin)
- **Full Control**: Access to all bot features and True Feed channel posting
- **Dashboard Analytics**: Monitor total users, active users, total posts, recent activity
- **News Browsing**: View and post news from 30+ sources to True Feed channel
- **Content Approval**: Review and approve AI-generated content ideas
- **Test Channel**: Post content to test channel before main channel

### Technical Features
- **AI-Powered**: Uses OpenRouter API (Google Gemini) for Amharic content generation
- **Smart Formatting**: Bold titles, bullet points, source links, channel attribution
- **Image Support**: Fetches and posts news articles with images
- **Responsive Dashboard**: Mobile-friendly dark theme dashboard with glassmorphism design
- **Serverless**: Runs on Telegram's platform - no server management needed
- **Real-time Updates**: Dashboard shows live statistics and recent activity

## News Sources

The bot fetches news from 30+ sources including:
- **Major Tech**: TechCrunch, The Verge, BBC Tech, Wired, VentureBeat, Engadget, Ars Technica, WIRED
- **Industry**: The Information, MIT Technology Review, Fast Company, The New Stack, Bloomberg Technology
- **Startup**: Hacker News, Techmeme, Sifted, Product Hunt, BetaList
- **Regional**: Rest of World, Tech in Asia, GeekWire
- **Africa**: TechCabal, Disrupt Africa, Tech In Africa
- **India**: YourStory, Inc42, Entrackr
- **UAE**: Wamda, Arabian Business
- **China**: TechNode, Pandaily, Caixin Global
- **Latin America**: LatamList, Contxto
- **Russia**: Rusbase

## Architecture

### Project Structure

```
TF-Agent/
├── tgcloud/                    # Deployed to Telegram's serverless platform
│   ├── schema.js               # Database schema (users, posts, ideas, pending_edits, custom_sources)
│   ├── handlers/               # Telegram update handlers
│   │   ├── message.js          # Message handler (commands, text input, onboarding)
│   │   └── callback_query.js   # Button click handler (news, settings, posting)
│   ├── endpoints/              # Mini App API endpoints
│   │   └── dashboard.js        # Dashboard data endpoint
│   └── lib/                    # Shared modules
│       ├── agent.js            # AI content generation (legacy ideas)
│       ├── database.js         # Database operations (CRUD, stats)
│       ├── news.js             # News fetching, RSS parsing, Amharic formatting
│       └── secrets.js          # API keys (OPENROUTER, TRUE_FEED_CHANNEL_ID, TEST_CHANNEL_ID)
├── dist/                       # Mini App static files (deployed)
│   └── index.html             # Dashboard UI (dark theme, glassmorphism, responsive)
├── public/                     # Local development files
│   └── dashboard.html         # Alternative dashboard
├── src/                        # Legacy local development (not deployed)
├── tgcloud.jsonc               # Tgcloud project config
├── package.json
├── AGENTS.md                   # Agent orientation guide
└── docs/
    └── tgcloud-sdk.md          # Tgcloud SDK documentation
```

### Database Schema

- **users**: Telegram user data, channel configuration, settings, stats
- **posts**: Posted content tracking (user_id, channel_id, content, category, source, image_url)
- **ideas**: AI-generated business ideas (legacy owner feature)
- **pending_edits**: Temporary storage for edited news content
- **custom_sources**: User-added custom RSS feed sources

## Deployment

### Tgcloud Platform

The bot runs on Telegram's serverless platform using the tgcloud CLI.

1. Install tgcloud CLI:
```bash
npm install -g @tgcloud/cli
```

2. Login to your Telegram bot account:
```bash
npx tgcloud login
```

3. Configure secrets in `tgcloud/lib/secrets.js`:
```javascript
export const OPENROUTER_API_KEY = 'your_openrouter_key';
export const TRUE_FEED_CHANNEL_ID = 'your_channel_id';
export const TEST_CHANNEL_ID = 'your_test_channel_id';
```

4. Set owner ID in `tgcloud/handlers/message.js`:
```javascript
const OWNER_CHAT_ID = 685669468; // Your Telegram chat ID
```

5. Deploy:
```bash
npx tgcloud push
```

6. If schema changes were made:
```bash
npx tgcloud migrate
```

### Useful Commands

```bash
npx tgcloud status       # Check deployment status
npx tgcloud push         # Deploy code and static files
npx tgcloud migrate      # Apply database schema changes
npx tgcloud webhook      # Check webhook configuration
npx tgcloud webhook sync # Repair webhook if mismatched
npx tgcloud run <module> # Test a handler/endpoint locally
```

## User Onboarding Flow

1. User sends `/start`
2. Bot asks to join True Feed channel
3. User provides channel username (e.g., @mychannel)
4. User adds bot as admin to their channel (Post Messages, Edit Messages permissions)
5. Optional: Set display name
6. Optional: Set bot display name
7. Select content categories
8. User can now generate and post content

## News Format

News articles are automatically formatted in Amharic:
```
<b>[Amharic Title in Bold]</b>

• Bullet point 1
• Bullet point 2
• Bullet point 3

<a href="source_url">Source Name</a>
@channel_username
```

Options:
- Toggle source link visibility
- Choose between Amharic punctuation (። ፤ ፣ ፡) or dot punctuation (. . and . . .)
- Add bot display name attribution

## Mini App Dashboard

Access the dashboard at the Mini App URL (shown after deployment) to view:
- Total users, active users, total posts
- Recent users with their channels and post counts
- Recent posts with channels, categories, and timestamps

Features:
- Dark theme with deep black background
- Glassmorphism card effects
- Animated number counting
- Responsive design for mobile devices
- Auto-refresh every 30 seconds

## Known Issues & Limitations

- **Timestamp Serialization**: Must convert database timestamp objects to numbers for JSON serialization
- **Callback Data Limit**: Telegram callback_data is limited to 64 bytes, so edit content is stored in database via pending_edits table
- **Authorization Flow**: Public user handlers must be placed BEFORE owner authorization check to avoid "Unauthorized" errors
- **No Foreign Keys**: Tgcloud runs with FKs off, must enforce integrity in application code
- **Schema Changes**: Must use `.deprecated()` for drops, type changes require manual SQL
- **Module Imports**: Must use relative paths with `.js` extension

## Configuration

### Required Secrets (tgcloud/lib/secrets.js)
- `OPENROUTER_API_KEY` - For AI content generation
- `TRUE_FEED_CHANNEL_ID` - Main True Feed channel ID
- `TEST_CHANNEL_ID` - Test channel for owner

### Optional Settings
- User can toggle source link display
- User can choose Amharic vs dot punctuation
- User can set custom bot display name
- User can add custom RSS sources

## Troubleshooting

### Dashboard not loading
- Check that `/api/dashboard` endpoint returns proper JSON
- Verify timestamp serialization (should be numbers, not objects)
- Check browser console for errors

### User edit feature not working
- Verify handlers are placed before owner authorization check
- Check that pending_edits table is being populated correctly
- Ensure callback_data doesn't exceed 64 bytes

### News not posting to user channel
- Verify bot is admin in user's channel (Post Messages, Edit Messages)
- Check that channel_id is valid username format (@channelname)
- Review error messages in Bot API responses

### Onboarding stuck
- Check that user.onboarding_step progresses correctly
- Verify channel username is saved in users table
- Ensure bot admin verification is working

## License

ISC
