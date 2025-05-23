import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import { commands } from './commands/commands.mjs';
import './utils/discord/loadCommands.mjs';
import connectDB from './utils/mongo/connection.mjs'; 
import { startBirthdayLoop } from './utils/discord/birthdayChecker.mjs'
import { startStreamLoop } from './utils/discord/streamChecker.mjs';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const PREFIX = '!';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences
    ],
});

const startBot = async () => {
    try {
        await connectDB(); 
        client.login(TOKEN); 
    } catch (error) {
        console.error("Failed to start bot:", error);
    }
};

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    startBirthdayLoop(client);
    startStreamLoop(client);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (commands[commandName]) {
        commands[commandName].execute(message, args);
    } else {
        message.channel.send("Unknown command! Use `!help` for a list of commands.");
    }
});

startBot();
