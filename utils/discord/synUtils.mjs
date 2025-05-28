import BirthdayModel from '../../DB/schemas/birthdaySchema.mjs'; 
import TimeZoneModel from '../../DB/schemas/timeZoneSchema.mjs';
import TwitchLinkModel from '../../DB/schemas/twitchLinkSchema.mjs';

import moment from 'moment-timezone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';


const monthMap = {
    1 : 'Jan',
    2 : 'Feb',
    3 : 'Mar',
    4 : 'Apr',
    5 : 'May',
    6 : 'Jun',
    7 : 'Jul',
    8 : 'Aug',
    9 : 'Sep',
    10 : 'Oct',
    11 : 'Nov',
    12 : 'Dec'  
}

const isValidUTCOffset = (input) => {
    const match = input.match(/^UTC([+-])(\d{1,2})(?::(00|15|30|45))?$/);
    if (!match) return false;
    
    const hour = parseInt(match[2]);
    return hour >= 0 && hour <= 14; 
};



export const ping = (message) => {
    message.channel.send('Pong!');
}

export const greet = (message) => {
    message.channel.send(`Hello, ${message.author.username}!`);
}

export const add = (message, args) => {
    if (args.length < 2) {
        message.channel.send('Please provide two numbers.');
        return;
    }
    const num1 = parseFloat(args[0]);
    const num2 = parseFloat(args[1]);
    if (isNaN(num1) || isNaN(num2)) {
        message.channel.send('Invalid numbers.');
        return;
    }
    message.channel.send(`The sum is ${num1 + num2}`);
}

export const listStreamers = async (message) => {
    const guild = message.guild;
    if (!guild) {
        message.channel.send("```Guild Not Found!```");
        return null;
    }

    try {
        const members = await guild.members.fetch();
        const cleanMembers = members.map(member => ({
            id: member.id,
            username: member.user.username,
            displayName: member.displayName,
            bot: member.user.bot,
            joinedAt: member.joinedAt.toISOString(),
            roles: member.roles.cache.map(role => role.name),
            streaming: member.presence?.activities.some(a => a.type === 'STREAMING')
        }));

        const streamers = cleanMembers.filter(member => 
            member.roles.includes('🎬 Streamer') 
        );

        if (streamers.length === 0) {
            message.channel.send("```No members with Streamer role found```");
            return null;
        }

        const streamerList = streamers.map(member => 
            `${member.displayName || member.username} (ID: ${member.id})`
        ).join('\n');

        message.channel.send(`**Streamer Role Members (${streamers.length}):**\n\`\`\`${streamerList}\`\`\``);
        console.log(streamers);
        return streamers;

    } catch (error) {
        console.error(error);
        message.channel.send(`\`\`\`Error: ${error.message}\`\`\``);
        return null;
    }
};


export const setBirthday = async (message, args) => {
    const authorMember = message.guild.members.cache.get(message.author.id);
    
    if (!authorMember.roles.cache.some(role => role.name === '💥 Mod')) {
        message.channel.send("❌ You don't have permission to use this command. Only **💥 Mod** can set birthdays.");
        return;
    }

    if (args.length < 3 || !message.mentions.users.size) {
        message.channel.send('!setbirthday @MentionUser DD M (e.g.  !setbirthday @Syn 29 3)`');
        return;
    }

    const mentionedUser = message.mentions.users.first();
    const day = args[1];
    const month = args[2];

    if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month)) {
        message.channel.send('❌ Day and month must be valid numbers.');
        return;
    }

    try {
        const existing = await BirthdayModel.findOne({ discordId: mentionedUser.id });

        if (existing) {
            existing.day = day;
            existing.month = parseInt(month) + "";
            await existing.save();
            message.channel.send(`🎉 Updated birthday for **${mentionedUser.username}** to **${parseInt(day)} ${monthMap[parseInt(month)]}**`);
        } else {
            const newBirthday = new BirthdayModel({
                discordId: mentionedUser.id,
                day,
                month: parseInt(month) + ""
            });
            await newBirthday.save();
            message.channel.send(`🎉 Set birthday for ${mentionedUser.username} to ${parseInt(day)} ${monthMap[parseInt(month)]}`);
        }
    } catch (error) {
        console.error('Error setting birthday:', error);
        message.channel.send(`\`\`\`Failed to set birthday: ${error.message}\`\`\``);
    }
};

export const getBirthday = async (message, _args) => {
    if (!message.mentions.users.size) {
        message.channel.send('Usage: `!birthday @user`');
        return;
    }

    const mentionedUser = message.mentions.users.first();

    try {
        const record = await BirthdayModel.findOne({ discordId: mentionedUser.id });

        if (!record) {
            message.channel.send(`❌ No birthday found for ${mentionedUser.username}.`);
            return;
        }

        message.channel.send(`🎂 ${mentionedUser.username}'s birthday is on **${parseInt(record.day)} ${monthMap[parseInt(record.month)]}**`);
    } catch (error) {
        console.error('Error fetching birthday:', error);
        message.channel.send(`\`\`\`Failed to fetch birthday: ${error.message}\`\`\``);
    }
};

export const setTimezone = async (message, args) => {
    const authorMember = message.guild.members.cache.get(message.author.id);
    
    if (!authorMember.roles.cache.some(role => role.name === '💥 Mod')) {
        message.channel.send("❌ You don't have permission to use this command. Only **💥 Mod** can set timezones.");
        return;
    }

    if (args.length < 2 || !message.mentions.users.size) {
        message.channel.send('❌ Usage: `!settimezone @User <timezone>` (e.g. `!settimezone @Syn Asia/Kolkata` or `UTC+5:30`)');
        return;
    }

    const mentionedUser = message.mentions.users.first();
    const timezone = args[1];

    const validTimezones = Intl.supportedValuesOf?.('timeZone') || [];
    const isIANA = validTimezones.includes(timezone);

    const isUTC = isValidUTCOffset(timezone);

    if (!isIANA && !isUTC) {
        message.channel.send(`❌ Invalid timezone: \`${timezone}\`. Use a valid IANA name (e.g. Asia/Kolkata) or UTC offset (e.g. UTC+5:30)`);
        return;
    }

    try {
        const existing = await TimeZoneModel.findOne({ discordId: mentionedUser.id });

        if (existing) {
            existing.timezone = timezone;
            await existing.save();
            message.channel.send(`🌍 Updated timezone for **${mentionedUser.username}** to **${timezone}**`);
        } else {
            const newTimezone = new TimeZoneModel({
                discordId: mentionedUser.id,
                timezone
            });
            await newTimezone.save();
            message.channel.send(`🌍 Set timezone for **${mentionedUser.username}** to **${timezone}**`);
        }
    } catch (error) {
        console.error('Error setting timezone:', error);
        message.channel.send(`\`\`\`Failed to set timezone: ${error.message}\`\`\``);
    }
};

export const getTime = async (message) => {
    if (!message.mentions.users.size) {
        message.channel.send('❌ Usage: `!time @User`');
        return;
    }

    const mentionedUser = message.mentions.users.first();

    try {
        const userTimeData = await TimeZoneModel.findOne({ discordId: mentionedUser.id });
        if (!userTimeData) {
            message.channel.send(`❌ No timezone found for **${mentionedUser.username}**. Use \`!settimezone\` to set one.`);
            return;
        }

        const userTimezone = userTimeData.timezone;
        const now = new Date();

        const parseTimezone = (tz) => {
            if (Intl.supportedValuesOf('timeZone')?.includes(tz)) {
                return moment.tz(now, tz);
            } else if (tz.startsWith('UTC')) {
                const match = tz.match(/^UTC([+-])(\d{1,2})(?::(00|15|30|45))?$/);
                if (!match) throw new Error('Invalid UTC offset format');
                const sign = match[1] === '+' ? 1 : -1;
                const hours = parseInt(match[2]) * sign;
                const minutes = parseInt(match[3] || '0') * sign;
                return moment.utc(now).add(hours, 'hours').add(minutes, 'minutes');
            } else {
                throw new Error('Unrecognized timezone format');
            }
        };

        const userTime = parseTimezone(userTimezone);

        message.channel.send(`🕒 Time for **${mentionedUser.username}**: **${userTime.format('dddd, MMMM Do YYYY, h:mm A')}** (${userTimezone})`);
    } catch (error) {
        console.error('Error fetching time:', error);
        message.channel.send(`\`\`\`Failed to fetch time: ${error.message}\`\`\``);
    }
};

export const setTwitch = async (message, args) => {
    const authorMember = message.guild.members.cache.get(message.author.id);
    if (!authorMember || !authorMember.roles.cache.some(role => role.name === '💥 Mod')) {
        message.channel.send("❌ You don't have permission to use this command. Only **💥 Mod** can set Twitch links.");
        return;
    }

    if (args.length < 2 || !message.mentions.users.size) {
        message.channel.send('❌ Usage: `!settwitch @MentionUser twitch_username`');
        return;
    }

    const mentionedUser = message.mentions.users.first();

    const twitchUsername = args[1 + message.mentions.users.size - 1]; 


    if (!twitchUsername) {
        message.channel.send('❌ Please provide the Twitch username. Usage: `!settwitch @MentionUser twitch_username`');
        return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(twitchUsername)) {
        message.channel.send('❌ Invalid Twitch username format. Twitch usernames can only contain letters, numbers, and underscores.');
        return;
    }

    try {
        // Optional: Verify if the Twitch user actually exists using the API
        // const twitchUsers = await getTwitchUsersByLogin([twitchUsername]);
        // if (twitchUsers.length === 0) {
        //      message.channel.send(`❌ Twitch user "${twitchUsername}" not found.`);
        //      return;
        // }
        // const twitchUserId = twitchUsers[0].id; 

        // Save or update the link in the database
        const existingLink = await TwitchLinkModel.findOne({ discordId: mentionedUser.id });

        if (existingLink) {
            if (existingLink.twitchUsername === twitchUsername) {
                message.channel.send(`✅ Twitch link for **${mentionedUser.username}** is already set to **${twitchUsername}**.`);
                return;
            }
            existingLink.twitchUsername = twitchUsername;
            await existingLink.save();
            message.channel.send(`✅ Updated Twitch link for **${mentionedUser.username}** to **${twitchUsername}**.`);
        } else {
            const newLink = new TwitchLinkModel({
                discordId: mentionedUser.id,
                twitchUsername: twitchUsername
            });
            await newLink.save();
            message.channel.send(`✅ Set Twitch link for **${mentionedUser.username}** to **${twitchUsername}**.`);
        }

    } catch (error) {
        console.error('Error setting Twitch link:', error);
        message.channel.send(`❌ Failed to set Twitch link: ${error.message}`);
    }
};

export const getLinkedStreamers = async (message) => {
    const guild = message.guild;
    if (!guild) {
        message.channel.send("Guild Not Found!");
        return;
    }

    try {
        const twitchLinks = await TwitchLinkModel.find({});

        if (twitchLinks.length === 0) {
            message.channel.send("```No Twitch links found in the database.```");
            return;
        }

        let maxDiscordNameLength = "Discord User (ID)".length;
        const streamerData = [];

        for (const link of twitchLinks) {
            try {
                const member = await guild.members.fetch(link.discordId);
                const discordName = member.displayName || member.user.username;
                const discordId = link.discordId;
                const twitchUsername = link.twitchUsername;

                const discordEntry = `${discordName} (${discordId})`;
                streamerData.push({ discordEntry, twitchUsername });

                if (discordEntry.length > maxDiscordNameLength) {
                    maxDiscordNameLength = discordEntry.length;
                }

            } catch (error) {
                console.error(`Could not fetch member with ID ${link.discordId}: ${error.message}`);
                const discordId = link.discordId;
                const twitchUsername = link.twitchUsername;
                const discordEntry = `Unknown User (${discordId})`;
                 streamerData.push({ discordEntry, twitchUsername });

                 if (discordEntry.length > maxDiscordNameLength) {
                    maxDiscordNameLength = discordEntry.length;
                }
            }
        }

        let response = "**Linked Streamers:**\n```";
        const headerDiscord = "Discord User (ID)".padEnd(maxDiscordNameLength);
        const headerTwitch = "Twitch Username";
        response += `${headerDiscord} | ${headerTwitch}\n`;
        response += "-".repeat(maxDiscordNameLength) + "---" + "-".repeat(headerTwitch.length) + "\n";


        for (const data of streamerData) {
            const paddedDiscord = data.discordEntry.padEnd(maxDiscordNameLength);
            response += `${paddedDiscord} | ${data.twitchUsername}\n`;
        }


        response += "```";
        message.channel.send(response);


    } catch (error) {
        console.error('Error fetching linked streamers:', error);
        message.channel.send(`\`\`\`Failed to fetch linked streamers: ${error.message}\`\`\``);
    }
};

export const ask = async (message, args) => {
    const question = args.join(' '); 

    if (!question) {
        message.channel.send('❌ Usage: `!ask <your question>`');
        return;
    }

    const apiKey = process.env.GOOGLE_API; 

    if (!apiKey) {
        console.error("GOOGLE_API environment variable not set.");
        message.channel.send('```Error: Gemini API key not configured on the server.```');
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        await message.channel.sendTyping();

        const result = await model.generateContent(question);

        const response = await result.response.text();

        const responseChunks = response.match(/[\s\S]{1,1900}/g) || []; 

        for (const chunk of responseChunks) {
            await message.channel.send(chunk);
        }

    } catch (error) {
        console.error('Error interacting with Gemini API:', error);
        message.channel.send(`\`\`\`Failed to get response: ${error.message}\`\`\``);
        if (error.message.includes('429')) {
             message.channel.send("Seems like I'm getting too many requests. Please try again later.");
        } else if (error.message.includes('403')) {
             message.channel.send("There was an authentication issue with the API. Check the API key.");
        }
    }
};





