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

## News Sources

The bot fetches news from over 50 sources including:
- Major Tech: TechCrunch, The Verge, BBC Tech, Wired, VentureBeat, Engadget, Ars Technica
- Industry: The Information, MIT Technology Review, Fast Company, The New Stack
- Startup: Hacker News, Techmeme, Sifted, Tech.eu, YourStory
- Regional: Rest of World, Morning Context, Entrackr, TechNode, KrASIA
- Africa: TechCabal, Disrupt Africa, Techpoint Africa, Wamda, Magnitt
- Latin America: Contxto, Startups Latam, Brazil Journal, LatamList
- Reviews: CNET, TechRadar, Gizmodo, Mashable, Digital Trends, ZDNET
- Enterprise: InfoWorld, TechRepublic, Gartner
- Community: HackerNoon, DEV Community, Slashdot, DZone
- Security: Krebs on Security
- Blogs: Daring Fireball, The Pragmatic Engineer, Netflix Tech Blog, Cloudflare Blog
- Telegram: Telegram Gram

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file with:
```
TELEGRAM_BOT_TOKEN=your_bot_token
OWNER_CHAT_ID=your_chat_id
TRUE_FEED_CHANNEL_ID=your_channel_id
OPENROUTER_API_KEY=your_openrouter_key
```

3. Start the bot:
```bash
node src/bot.js
```

## Usage

- Use the bot to generate business ideas and content
- Review and approve/reject content before posting
- Fetch news from various sources and translate to Amharic
- Post approved content to the True Feed channel