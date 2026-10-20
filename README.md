# TF-Agent 🌱

A serverless Telegram Bot & Mini App for **True Feed** that scrapes global news across 8 categories, generates faithful Amharic translations using AI, and automatically publishes formatted content to Telegram channels.

---

## ⚡ Features

- **30+ Live Sources & 8 Categories**: Tech & AI, Business, World News, Startups & Africa, Science, Crypto, Entertainment, and Sports.
- **Full Webpage Scraping**: Fetches the live article webpage to extract complete context before AI translation.
- **Faithful Amharic Translation**: Direct, context-preserving translation with bold headlines and bullet points (no hallucinated local stories).
- **Simple Onboarding**: Users only need to provide their channel username (`@yourchannel`), link, or forward any post — no numeric IDs needed.
- **Admin Verification**: Automatic permission checks and flexible channel reconfiguration.
- **Cyberpunk Black & Green Dashboard**: Real-time Mini App telemetry, creator stats, and post feeds at [app8909892200.tgcloud.ai](https://app8909892200.tgcloud.ai/).

---

## 📁 Project Structure

```
TF-Agent/
├── tgcloud/                    # Serverless V8 isolate code
│   ├── handlers/               # Telegram update handlers (message.js, callback_query.js)
│   ├── endpoints/              # Mini App backend API (dashboard.js)
│   ├── lib/                    # Shared modules (news.js, channel.js, database.js, agent.js)
│   └── schema.js               # Database schema (users, posts, pending_edits, custom_sources)
├── dist/                       # Static Mini App frontend (Black & Green dashboard)
├── tgcloud.jsonc               # Tgcloud deployment configuration
└── package.json
```

---

## 🚀 Quickstart & Commands

This project runs on Telegram's serverless isolate platform via the `tgcloud` CLI.

```bash
# Check changes vs cloud
npx tgcloud status

# Deploy code and static dashboard to cloud
npx tgcloud push

# Run and test a module server-side
npx tgcloud run handlers/message '{"text":"/start","from":{"id":12345}}'
```
