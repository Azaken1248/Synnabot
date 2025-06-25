import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import { commands } from './commands/commands.mjs'; 
import './utils/discord/loadCommands.mjs'; 
import connectDB from './utils/mongo/connection.mjs';
import { startBirthdayLoop } from './utils/discord/birthdayChecker.mjs'
import { startStreamLoop } from './utils/discord/streamChecker.mjs';
import { registerSlashCommands } from './utils/discord/discordUtils.mjs'; 
import * as synUtilsCommands from './utils/discord/synUtils.mjs';


import express from 'express';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const PREFIX = '!';
const STATUS_API_PORT = process.env.STATUS_API_PORT || 6363;


const statusApp = express();


statusApp.get('/status', (_req, res) => {
    const botStatus = client && client.isReady() ? 'online' : 'offline';
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


const slashCommandHandlers = {
    ping: synUtilsCommands.ping,
    hello: synUtilsCommands.greet, 
    add: synUtilsCommands.add,
    streamers: synUtilsCommands.listStreamers,
    setbirthday: synUtilsCommands.setBirthday,
    birthday: synUtilsCommands.getBirthday,
    settimezone: synUtilsCommands.setTimezone,
    time: synUtilsCommands.getTime,
    settwitch: synUtilsCommands.setTwitch,
    streamlinks: synUtilsCommands.getLinkedStreamers,
    ask: synUtilsCommands.ask,
};


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

client.once('ready', async () => { 
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(`Bot is ready: ${client.isReady()}`);

    await registerSlashCommands(client.application.id); 

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
            console.error(`Error executing prefix command ${commandName}:`, error);
            message.channel.send('There was an error trying to execute that command!');
        }
    } else {
         if (commandName === 'help') {
             //TODO: Handle help command logic here or add it to synUtils/loadCommands
         } else {
             message.channel.send(`Unknown command \`!${commandName}\`. Use \`!help\` for a list of commands.`);
         }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    const handler = slashCommandHandlers[commandName];

    if (!handler) {
        console.error(`No handler found for slash command ${commandName}`);
        await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
        return;
    }

    try {
        await handler(interaction); 
    } catch (error) {
        console.error(`Error executing slash command ${commandName}:`, error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'There was an error trying to execute that command!', ephemeral: true });
        } else {
            await interaction.followUp({ content: 'There was an error trying to execute that command!', ephemeral: true });
        }
    }
});


startBot();