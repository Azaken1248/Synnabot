import { REST, Routes } from 'discord.js';
import 'dotenv/config';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
//const CLIENT_ID = process.env.CLIENT_ID;

const slashCommands = [
  {
    name: 'ping',
    description: 'Replies with Pong!',
  },
  {
    name: 'hello',
    description: 'Replies with a greeting!',
  },
  {
    name: 'add',
    description: 'Adds two numbers.',
    options: [
        {
            name: 'num1',
            description: 'The first number',
            type: 10,
            required: true,
        },
        {
            name: 'num2',
            description: 'The second number',
            type: 10,
            required: true,
        },
    ],
  },
  {
    name: 'streamers',
    description: 'Lists all users with the "Streamer" role',
  },
  {
    name: 'setbirthday',
    description: 'Set birthday of a member (Mod only).',
    options: [
        {
            name: 'user',
            description: 'The user whose birthday to set',
            type: 6, 
            required: true,
        },
        {
            name: 'day',
            description: 'The day of the month (e.g., 29)',
            type: 4, 
            required: true,
        },
         {
            name: 'month',
            description: 'The month (1-12, e.g., 3 for March)',
            type: 4,
            required: true,
        },
    ],
  },
  {
    name: 'birthday',
    description: 'Get birthday of a member.',
     options: [
        {
            name: 'user',
            description: 'The user whose birthday to get',
            type: 6, 
            required: true,
        },
    ],
  },
   {
    name: 'settimezone',
    description: 'Set the timezone of a user (Mod only).',
    options: [
        {
            name: 'user',
            description: 'The user whose timezone to set',
            type: 6, 
            required: true,
        },
        {
            name: 'timezone',
            description: 'The timezone (e.g., Asia/Kolkata or UTC+5:30)',
            type: 3, 
            required: true,
        },
    ],
  },
  {
    name: 'time',
    description: 'Get the current time for a user based on their timezone.',
     options: [
        {
            name: 'user',
            description: 'The user whose time to get',
            type: 6, 
            required: true,
        },
    ],
  },
   {
    name: 'settwitch',
    description: 'Set the Twitch username for a user (Mod only).',
    options: [
        {
            name: 'user',
            description: 'The user to link the Twitch account to',
            type: 6, 
            required: true,
        },
        {
            name: 'username',
            description: 'The Twitch username',
            type: 3, 
            required: true,
        },
    ],
  },
  {
    name: 'streamlinks',
    description: 'Get the list of users linked to Twitch accounts.',
  },
  {
    name: 'ask',
    description: 'Ask a question to Gemini AI.',
    options: [
        {
            name: 'question',
            description: 'Your question for the AI',
            type: 3, 
            required: true,
        },
    ],
  },
];


export const registerSlashCommands = async (clientId) => {
    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log(`Started refreshing ${slashCommands.length} application (/) commands.`);

        await rest.put(
            Routes.applicationCommands(clientId),
            { body: slashCommands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
};

export { slashCommands };