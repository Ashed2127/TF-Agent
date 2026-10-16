# TF-Agent

Telegram bot for True Feed channel that generates Amharic business ideas, content ideas, and curates news using AI, with admin approval workflow. Built on Telegram's serverless platform (tgcloud).

## Features

- **AI-Generated Content**: Creates Amharic business ideas and content suggestions using OpenRouter API
- **AI News Translation**: Fetches news from 30+ tech sources and generates Amharic content with Ethiopian context using AI
- **Smart News Formatting**: Amharic titles with emojis, bullet point summaries, and bold @true_feed attribution
- **Telegram Approval Workflow**: Admin can review, approve, or reject content before posting to channels
- **Multiple News Sources**: TechCrunch, The Verge, BBC Tech, Wired, VentureBeat, Sifted, and many more
- **Category Rotation**: Cycles through different business categories for diverse content
- **Image Support**: Posts news articles with images when available
- **Web Dashboard**: Monitor bot activity and posts
- **Tgcloud Deployment**: Serverless deployment on Telegram's platform
- **Local Development**: Express server for web dashboard development

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

## Prerequisites

- Node.js >= 20.0.0
- @tgcloud/cli (for deployment)
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- OpenRouter API Key
- (Optional) Giphy API Key for GIF features

## Local Development Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd TF-Agent
```

2. Install dependencies:
```bash
npm install
```

3. Configure secrets in `tgcloud/lib/secrets.js`:
```javascript
export const OPENROUTER_API_KEY = 'your_openrouter_key';
export const TRUE_FEED_CHANNEL_ID = '-1002467061421'; // Your channel ID
export const TEST_CHANNEL_ID = '-1002379106699'; // Test channel ID
export const GIPHY_API_KEY = 'your_giphy_key'; // Optional
```

4. Set your owner chat ID in `tgcloud/handlers/message.js`:
```javascript
const OWNER_CHAT_ID = 685669468; // Your Telegram chat ID
```

5. Run local development server (for web dashboard):
```bash
npm start
```

Or use nodemon for development:
```bash
npm run dev
```

## Tgcloud Deployment

The bot runs on Telegram's serverless platform using the tgcloud CLI.

### Initial Setup

1. Install tgcloud CLI (if not already installed):
```bash
npm install -g @tgcloud/cli
```

2. Login to your Telegram bot account:
```bash
npx tgcloud login
```

3. Configure secrets in `tgcloud/lib/secrets.js` (as shown in Local Development Setup)

### Deploying

1. Check what will be deployed:
```bash
npx tgcloud status
```

2. Deploy your bot code to Telegram's platform:
```bash
npx tgcloud push
```

3. If you made schema changes to `tgcloud/schema.js`, apply database migrations:
```bash
npx tgcloud migrate
```

### Useful Commands

```bash
npx tgcloud status       # Check deployment status
npx tgcloud push         # Deploy code and static files
npx tgcloud migrate      # Apply database schema changes
npx tgcloud pull         # Sync local project with cloud
npx tgcloud webhook      # Check webhook configuration
npx tgcloud webhook sync # Repair webhook if mismatched
npx tgcloud run <module> # Test a handler/endpoint locally
```

### Project Structure (tgcloud)

The platform deploys everything in the `tgcloud/` folder:

- `tgcloud/schema.js` - Database schema (tables as named exports)
- `tgcloud/lib/` - Shared modules (can have subdirectories)
- `tgcloud/handlers/` - Update handlers (one level only, named by Telegram update type)
- `tgcloud/endpoints/` - Mini App API endpoints (POST /api/<name>)

Everything else (src/, public/, docs/) is local-only and not deployed.

For full documentation, see [AGENTS.md](AGENTS.md) and [docs/tgcloud-sdk.md](docs/tgcloud-sdk.md).

## Usage

### Telegram Bot Commands

- `/start` - Initialize the bot and show main menu
- **idea** - AI generates Amharic business ideas
- **news** - Browse news from 30+ sources
- **Approve/Reject** - Review content before posting to channel
- **Post to TrueFeed** - Send approved content to main channel
- **Post to Test** - Send to test channel for review

### News Format

News articles are automatically formatted in Amharic:
```
<b>[Amharic Title in Bold]</b>

• Bullet point 1
• Bullet point 2
• Bullet point 3

<b>@true_feed</b>
```

### Web Dashboard

Access the dashboard at `http://localhost:3000` (local) to:
- View generated ideas
- Check bot statistics
- Monitor activity

## Project Structure

```
TF-Agent/
├── tgcloud/                # Deployed to Telegram's serverless platform
│   ├── schema.js           # Database schema
│   ├── handlers/           # Telegram update handlers
│   │   ├── message.js      # Message handler
│   │   └── callback_query.js # Button click handler
│   └── lib/                # Shared modules
│       ├── agent.js        # AI content generation
│       ├── database.js     # Database operations
│       ├── news.js         # News fetching and formatting
│       └── secrets.js      # API keys and secrets
├── src/                    # Local development only
│   ├── agent.js            # AI content generation (legacy)
│   ├── bot.js              # Original bot (polling mode)
│   ├── bot-webhook.js      # Webhook bot (legacy)
│   ├── database.js         # MongoDB operations (legacy)
│   ├── imageEditor.js      # Image processing
│   ├── newsScraper.js      # News source scrapers (legacy)
│   ├── postGenerator.js    # Post generation logic
│   ├── postParser.js       # Post parsing utilities
│   └── prompts.js          # AI prompts
├── public/
│   └── dashboard.html      # Web dashboard
├── api/
│   └── index.js            # Vercel API endpoint (legacy)
├── server.js               # Express server (local dev)
├── tgcloud.jsonc           # Tgcloud project config
├── package.json
├── AGENTS.md               # Agent orientation guide
└── docs/
    └── tgcloud-sdk.md      # Tgcloud SDK documentation
```

## Configuration

### Tgcloud Secrets (tgcloud/lib/secrets.js)

Configure these secrets in `tgcloud/lib/secrets.js`:

```javascript
export const OPENROUTER_API_KEY = 'your_openrouter_key';      // Required - AI generation
export const TRUE_FEED_CHANNEL_ID = '-1002467061421';         // Required - Main channel
export const TEST_CHANNEL_ID = '-1002379106699';             // Required - Test channel
export const GIPHY_API_KEY = 'your_giphy_key';               // Optional - GIF features
```

### Owner Authorization

Set your Telegram chat ID in `tgcloud/handlers/message.js`:

```javascript
const OWNER_CHAT_ID = 685669468; // Only this user can control the bot
```

### Environment Variables (Local Development Only)

For local development with the Express server (web dashboard):

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `OWNER_CHAT_ID` | Yes | Your Telegram chat ID |
| `TRUE_FEED_CHANNEL_ID` | No | Channel ID to post approved content |
| `OPENROUTER_API_KEY` | Yes | API key for AI content generation |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `PORT` | No | Server port (default: 3000) |
| `GIPHY_API_KEY` | No | Giphy API key for GIF features |

## Important Notes

- **Authorization**: Only the `OWNER_CHAT_ID` can use the bot. Other users will receive an "Unauthorized" message.
- **Tgcloud Platform**: The bot runs on Telegram's serverless platform - no server to manage, no MongoDB required.
- **Database**: Uses tgcloud's built-in database (managed by the platform).
- **Webhook Management**: Tgcloud automatically manages webhooks based on your deployed handlers.
- **Module System**: Imports must use relative paths with `.js` extension (e.g., `import { x } from '../lib/file.js'`).
- **No Filesystem**: Tgcloud modules cannot access the filesystem or npm packages at runtime.

## Troubleshooting

### Deployment issues
1. Run `npx tgcloud status` to check what will be deployed
2. Ensure you're logged in with `npx tgcloud login`
3. Check that secrets are configured in `tgcloud/lib/secrets.js`
4. Verify handler names match Telegram update types (message, callback_query, etc.)

### Bot not responding
1. Check webhook status with `npx tgcloud webhook`
2. If webhook is mismatched, run `npx tgcloud webhook sync`
3. Verify OWNER_CHAT_ID is correct in `tgcloud/handlers/message.js`
4. Check tgcloud logs for errors

### AI generation failing
1. Verify OPENROUTER_API_KEY is valid in `tgcloud/lib/secrets.js`
2. Check if the API has available credits
3. Review error messages in the console

### Local development issues
1. Ensure Node.js version is >= 20.0.0
2. Run `npm install` to install dependencies
3. For web dashboard, ensure MongoDB is running if using legacy src/ files

## License

ISC

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
