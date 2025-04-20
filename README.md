# Slack GPT Thread Bot

A Slack bot that uses OpenAI's GPT-4 to respond to messages in threads, maintaining conversation context.

## Features

- Responds to messages in Slack threads
- Maintains conversation context using MongoDB
- Uses OpenAI's GPT-4 for generating responses
- Supports multiple channels (configurable)
- Handles image attachments with GPT-4 Vision
- Maintains thread context for both text and images

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- OpenAI API key
- Slack Bot Token
- Slack App Token (for Socket Mode)
- Slack Signing Secret

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Nyokinokonoko/slack-gpt-thread-bot.git
   cd slack-gpt-thread-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_SIGNING_SECRET=your-signing-secret
   SLACK_APP_TOKEN=xapp-your-app-token  # Required for Socket Mode
   OPENAI_API_KEY=your-openai-api-key
   MONGODB_URI=your-mongodb-uri
   MONGODB_DB_NAME=slack-gpt
   ALLOWED_CHANNELS=channel1,channel2
   ```

## Slack App Configuration

1. Create a new Slack app at https://api.slack.com/apps
2. Enable Socket Mode (recommended) or configure Event Subscriptions with a public URL
3. Add the following Bot Token Scopes:
   - `app_mentions:read` - To receive mentions
   - `chat:write` - To send messages
   - `channels:history` - To read channel messages
   - `groups:history` - To read private channel messages
   - `im:history` - To read direct messages
   - `mpim:history` - To read group direct messages
   - `files:read` - To read file information
   - `files:read.history` - To access file history
   - `chat:write.public` - To write messages in public channels
   - `chat:write.customize` - To customize message appearance
   - `users:read` - To read user information (for admin verification)

4. Install the app to your workspace
5. Copy the Bot User OAuth Token, App-Level Token, and Signing Secret to your `.env` file

## Usage

1. Start the bot:
   ```bash
   npm start
   ```

2. The bot will respond to messages in the configured channels
3. Images can be sent along with text messages for analysis
4. The bot maintains conversation context within threads

## Environment Variables

- `SLACK_BOT_TOKEN`: Your Slack Bot User OAuth Token
- `SLACK_SIGNING_SECRET`: Your Slack Signing Secret
- `SLACK_APP_TOKEN`: Your Slack App-Level Token (required for Socket Mode)
- `OPENAI_API_KEY`: Your OpenAI API Key
- `MONGODB_URI`: Your MongoDB connection string
- `MONGODB_DB_NAME`: Your MongoDB database name (default: slack-gpt)
- `ALLOWED_CHANNELS`: Comma-separated list of channel IDs where the bot should respond (optional)

## License

MIT