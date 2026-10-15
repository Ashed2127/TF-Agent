# Vercel Webhook Setup for TF Agent

Your Telegram bot has been adapted to work with Vercel using webhooks instead of long-polling. Follow these steps to complete the setup:

## 1. Add Environment Variables to Vercel

Go to your Vercel project dashboard and add these environment variables:

- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token from BotFather
- `OWNER_CHAT_ID` - Your Telegram chat ID (the only user authorized to use the bot)
- `TRUE_FEED_CHANNEL_ID` - Your True Feed channel ID (optional)
- `OPENROUTER_API_KEY` - Your OpenRouter API key for AI generation
- `MONGODB_URI` - Your MongoDB connection string
- `GIPHY_API_KEY` - Your Giphy API key (optional, for GIF features)

## 2. Set Up Telegram Webhook

After deploying to Vercel, you need to tell Telegram to send updates to your webhook URL:

```bash
# Replace YOUR_VERCEL_URL with your actual Vercel deployment URL
curl -F "url=https://YOUR_VERCEL_URL/api/webhook" \
  https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

For example:
```bash
curl -F "url=https://tf-agent.vercel.app/api/webhook" \
  https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/setWebhook
```

## 3. Verify Webhook Setup

Check if the webhook is set correctly:

```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

You should see your Vercel URL in the response.

## 4. Test the Bot

Send `/start` to your bot in Telegram. It should respond with the welcome message and menu options.

## 5. Important Notes

- **Session Storage**: The current implementation uses in-memory session storage. This means sessions will be reset when Vercel spins down your serverless function. For production, consider using a database like Redis for session persistence.

- **Database Connection**: MongoDB connection is established on each function invocation. For production, consider connection pooling.

- **Local Development**: For local development, you can still use the original `server.js` with polling. The webhook version is only for Vercel deployment.

- **Webhook Security**: Your webhook endpoint is public. Ensure your bot authorization middleware (already implemented) only allows your `OWNER_CHAT_ID` to use the bot.

## 6. Troubleshooting

If the bot doesn't respond:

1. Check Vercel logs for errors
2. Verify the webhook URL is correct
3. Ensure all environment variables are set in Vercel
4. Check that MongoDB is accessible from Vercel
5. Verify your `OWNER_CHAT_ID` is correct

## 7. Switching Back to Polling (Local)

If you need to run locally with polling instead of webhooks:

```bash
# Delete the webhook
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook

# Run locally
npm run dev
```

The original `src/bot.js` file uses polling and is unchanged for local development.
