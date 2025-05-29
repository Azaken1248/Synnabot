import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import { commands } from './commands/commands.mjs';
import './utils/discord/loadCommands.mjs';
import connectDB from './utils/mongo/connection.mjs';
import { startBirthdayLoop } from './utils/discord/birthdayChecker.mjs'
import { startStreamLoop } from './utils/discord/streamChecker.mjs';


import express from 'express';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const PREFIX = '!';
const STATUS_API_PORT = process.env.STATUS_API_PORT || 6363; 


const statusApp = express();


statusApp.get('/status', (_req, res) => {
    const botStatus = client.isReady() ? 'online' : 'offline';
    res.json({ status: botStatus });
});


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
        statusApp.listen(STATUS_API_PORT, () => {
            console.log(`Status API listening on port ${STATUS_API_PORT}`);
        });

        client.login(TOKEN);

    } catch (error) {
        console.error("Failed to start bot or status API:", error);
    }
};

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(`Bot is ready: ${client.isReady()}`); 
    startBirthdayLoop(client);
    startStreamLoop(client);
});

client.on('disconnected', (event) => {
    console.log(`Bot disconnected! Code: ${event.code}`);
    console.log(`Bot is ready: ${client.isReady()}`); 
});

client.on('error', (error) => {
    console.error('Bot encountered an error:', error);
     console.log(`Bot is ready: ${client.isReady()}`); 
});


client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (commands[commandName]) {
        try {
            await commands[commandName].execute(message, args);
        } catch (error) {
            console.error(`Error executing command ${commandName}:`, error);
            message.channel.send('There was an error trying to execute that command!');
        }
    } else {
        message.channel.send("Unknown command! Use `!help` for a list of commands.");
    }
});

startBot();