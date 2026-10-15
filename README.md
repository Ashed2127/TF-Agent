# TF-Agent

Telegram bot for True Feed channel that generates Amharic business ideas, content ideas, and translates news using AI, with admin approval workflow.

## Features

- **AI-Generated Content**: Creates Amharic business ideas and content suggestions using OpenRouter API
- **News Translation**: Fetches news from 50+ tech sources and translates titles/sources to Amharic with Ethiopian context
- **Telegram Approval Workflow**: Admin can review, approve, or reject content before posting
- **Multiple News Sources**: TechCrunch, The Verge, BBC Tech, Wired, VentureBeat, and many more
- **Category Rotation**: Cycles through different business categories for diverse content
- **Image Support**: Posts news articles with images when available
- **Web Dashboard**: Monitor bot activity and posts
- **Vercel Deployment**: Serverless deployment with webhook support
- **Local Development**: Support for both polling (local) and webhook (Vercel) modes

## News Sources

The bot fetches news from over 50 sources including:
- **Major Tech**: TechCrunch, The Verge, BBC Tech, Wired, VentureBeat, Engadget, Ars Technica
- **Industry**: The Information, MIT Technology Review, Fast Company, The New Stack
- **Startup**: Hacker News, Techmeme, Sifted, Tech.eu, YourStory
- **Regional**: Rest of World, Morning Context, Entrackr, TechNode, KrASIA
- **Africa**: TechCabal, Disrupt Africa, Techpoint Africa, Wamda, Magnitt
- **Latin America**: Contxto, Startups Latam, Brazil Journal, LatamList
- **Reviews**: CNET, TechRadar, Gizmodo, Mashable, Digital Trends, ZDNET
- **Enterprise**: InfoWorld, TechRepublic, Gartner
- **Community**: HackerNoon, DEV Community, Slashdot, DZone
- **Security**: Krebs on Security
- **Blogs**: Daring Fireball, The Pragmatic Engineer, Netflix Tech Blog, Cloudflare Blog
- **Telegram**: Telegram Gram

## Prerequisites

- Node.js >= 20.0.0
- MongoDB database
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

3. Create `.env` file from the example:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```
TELEGRAM_BOT_TOKEN=your_bot_token
OWNER_CHAT_ID=your_chat_id
TRUE_FEED_CHANNEL_ID=@true_feed
OPENROUTER_API_KEY=your_openrouter_key
MONGODB_URI=mongodb://localhost:27017/tf-agent
PORT=3000
GIPHY_API_KEY=your_giphy_key  # Optional
```

5. Start the bot with polling:
```bash
npm start
```

Or use nodemon for development:
```bash
npm run dev
```

## Vercel Deployment

### Quick Deploy

1. Push this repository to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard:
   - `TELEGRAM_BOT_TOKEN`
   - `OWNER_CHAT_ID`
   - `TRUE_FEED_CHANNEL_ID`
   - `OPENROUTER_API_KEY`
   - `MONGODB_URI`
   - `GIPHY_API_KEY` (optional)
4. Deploy

### Webhook Setup

After deploying to Vercel, set up the Telegram webhook:

```bash
# Replace YOUR_VERCEL_URL with your actual Vercel deployment URL
curl -F "url=https://YOUR_VERCEL_URL/api/webhook" \
  https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

Verify the webhook:
```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

For detailed webhook setup instructions, see [WEBHOOK_SETUP.md](WEBHOOK_SETUP.md).

## Usage

### Telegram Bot Commands

- `/start` - Initialize the bot and show main menu
- **Generate Idea** - AI generates Amharic business ideas
- **News** - Browse news from 50+ sources
- **Approve/Reject** - Review content before posting to channel

### Web Dashboard

Access the dashboard at `http://localhost:3000` (local) or your Vercel URL to:
- View generated ideas
- Check bot statistics
- Monitor activity

## Project Structure

```
TF-Agent/
├── api/
│   └── webhook.js          # Vercel webhook endpoint
├── public/
│   └── dashboard.html      # Web dashboard
├── src/
│   ├── agent.js            # AI content generation
│   ├── bot.js              # Original bot (polling mode)
│   ├── bot-webhook.js      # Webhook bot (Vercel mode)
│   ├── database.js         # MongoDB operations
│   ├── imageEditor.js      # Image processing
│   ├── newsScraper.js      # News source scrapers
│   ├── postGenerator.js    # Post generation logic
│   ├── postParser.js       # Post parsing utilities
│   └── prompts.js          # AI prompts
├── server.js               # Express server
├── vercel.json             # Vercel configuration
├── package.json
└── .env.example
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `OWNER_CHAT_ID` | Yes | Your Telegram chat ID (only authorized user) |
| `TRUE_FEED_CHANNEL_ID` | No | Channel ID to post approved content |
| `OPENROUTER_API_KEY` | Yes | API key for AI content generation |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `PORT` | No | Server port (default: 3000) |
| `GIPHY_API_KEY` | No | Giphy API key for GIF features |

## Important Notes

- **Authorization**: Only the `OWNER_CHAT_ID` can use the bot. Other users will receive an "Unauthorized" message.
- **Session Storage**: Webhook mode uses in-memory sessions (reset on function restart). For production, consider Redis.
- **Database**: MongoDB connection is established per request. For high traffic, implement connection pooling.
- **Local vs Vercel**: Use `src/bot.js` for local development (polling) and `api/webhook.js` for Vercel (webhook).

## Troubleshooting

### Bot not responding on Vercel
1. Check Vercel function logs
2. Verify webhook URL is set correctly
3. Ensure all environment variables are configured
4. Check MongoDB connectivity

### Local development issues
1. Ensure MongoDB is running
2. Verify `.env` file exists and is configured
3. Check that Node.js version is >= 20.0.0

### Switching between polling and webhook
To switch from webhook back to polling (local):
```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook
```

## License

ISC

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.