# TF-Agent 🌱

A serverless Telegram Bot & Mini App for **True Feed** that scrapes global news across 8 categories, generates faithful Amharic translations using AI, and automatically publishes formatted content to Telegram channels.

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
