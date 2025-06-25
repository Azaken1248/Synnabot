// utils/discord/synUtils.mjs
import BirthdayModel from '../../DB/schemas/birthdaySchema.mjs';
import TimeZoneModel from '../../DB/schemas/timeZoneSchema.mjs';
import TwitchLinkModel from '../../DB/schemas/twitchLinkSchema.mjs';

import moment from 'moment-timezone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const isMessage = (context) => context.channel && context.author;
const isInteraction = (context) => context.isChatInputCommand;

const sendReply = async (context, content, isEphemeral = false) => {
    if (isMessage(context)) {
        await context.channel.send(content);
    } else if (isInteraction(context)) {
        if (context.deferred || context.replied) {
             await context.editReply({ content, ephemeral: isEphemeral });
        } else {
             await context.reply({ content, ephemeral: isEphemeral });
        }
    }
};

const deferReply = async (context, isEphemeral = false) => {
    if (isInteraction(context) && !context.deferred && !context.replied) {
        await context.deferReply({ ephemeral: isEphemeral });
    }
};


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



export const ping = async (context, args) => {
     await sendReply(context, 'Pong!');
}

export const greet = async (context, args) => {
    const username = isMessage(context) ? context.author.username : context.user.username;
    await sendReply(context, `Hello, ${username}!`);
}

export const add = async (context, args) => {
    let num1, num2;

    if (isMessage(context)) {
        if (args.length < 2) {
            await sendReply(context, 'Please provide two numbers. Usage: `!add 5 10`');
            return;
        }
        num1 = parseFloat(args[0]);
        num2 = parseFloat(args[1]);
    } else if (isInteraction(context)) {
        num1 = context.options.getNumber('num1');
        num2 = context.options.getNumber('num2');
    } else {
        await sendReply(context, 'Invalid context.');
        return;
    }

    if (isNaN(num1) || isNaN(num2)) {
        await sendReply(context, 'Invalid numbers.');
        return;
    }

    await sendReply(context, `The sum is ${num1 + num2}`);
}

export const listStreamers = async (context) => {
    const guild = context.guild;
    if (!guild) {
        await sendReply(context, "```Guild Not Found!```");
        return null;
    }

    await deferReply(context); 

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
            await sendReply(context, "```No members with Streamer role found```");
            return null;
        }

        const streamerList = streamers.map(member =>
            `${member.displayName || member.username} (ID: ${member.id})`
        ).join('\n');

        await sendReply(context, `**Streamer Role Members (${streamers.length}):**\n\`\`\`${streamerList}\`\`\``);
        console.log(streamers); 
        return streamers;

    } catch (error) {
        console.error(error);
        await sendReply(context, `\`\`\`Error: ${error.message}\`\`\``);
        return null;
    }
};


export const setBirthday = async (context, args) => {
    const guild = context.guild;
    const authorMember = isMessage(context)
        ? guild.members.cache.get(context.author.id)
        : context.member; 

    if (!authorMember || !authorMember.roles.cache.some(role => role.name === '💥 Mod')) {
        await sendReply(context, "❌ You don't have permission to use this command. Only **💥 Mod** can set birthdays.", isInteraction(context));
        return;
    }

    await deferReply(context); 

    let mentionedUser, day, month;

    if (isMessage(context)) {
        if (args.length < 3 || !context.mentions.users.size) {
            await sendReply(context, 'Usage: `!setbirthday @MentionUser DD M` (e.g.  `!setbirthday @Syn 29 3`)');
            return;
        }
        mentionedUser = context.mentions.users.first();
        day = args[1];
        month = args[2];
    } else if (isInteraction(context)) {
        mentionedUser = context.options.getUser('user');
        day = context.options.getInteger('day');
        month = context.options.getInteger('month');
    } else {
         await sendReply(context, 'Invalid context.');
        return;
    }

     if (!mentionedUser) {
         await sendReply(context, '❌ Could not find the mentioned user.', isInteraction(context));
         return;
     }

    if (typeof day !== 'number' || typeof month !== 'number' || day < 1 || day > 31 || month < 1 || month > 12) {
        await sendReply(context, '❌ Day must be between 1-31 and Month between 1-12.', isInteraction(context));
        return;
    }


    try {
        const existing = await BirthdayModel.findOne({ discordId: mentionedUser.id });

        if (existing) {
            existing.day = day.toString(); 
            existing.month = month.toString(); 
            await existing.save();
            await sendReply(context, `🎉 Updated birthday for **${mentionedUser.username}** to **${day} ${monthMap[month]}**`);
        } else {
            const newBirthday = new BirthdayModel({
                discordId: mentionedUser.id,
                day: day.toString(),
                month: month.toString()
            });
            await newBirthday.save();
            await sendReply(context, `🎉 Set birthday for ${mentionedUser.username} to ${day} ${monthMap[month]}`);
        }
    } catch (error) {
        console.error('Error setting birthday:', error);
        await sendReply(context, `\`\`\`Failed to set birthday: ${error.message}\`\`\``);
    }
};

export const getBirthday = async (context, args) => {
    let mentionedUser;

    if (isMessage(context)) {
        if (!context.mentions.users.size) {
            await sendReply(context, 'Usage: `!birthday @user`');
            return;
        }
        mentionedUser = context.mentions.users.first();
    } else if (isInteraction(context)) {
        mentionedUser = context.options.getUser('user');
    } else {
        await sendReply(context, 'Invalid context.');
        return;
    }

     if (!mentionedUser) {
         await sendReply(context, '❌ Could not find the mentioned user.', isInteraction(context));
         return;
     }

    await deferReply(context);

    try {
        const record = await BirthdayModel.findOne({ discordId: mentionedUser.id });

        if (!record) {
            await sendReply(context, `❌ No birthday found for **${mentionedUser.username}**. Use \`!setbirthday\` to set one.`, isInteraction(context));
            return;
        }

        await sendReply(context, `🎂 **${mentionedUser.username}**'s birthday is on **${parseInt(record.day)} ${monthMap[parseInt(record.month)]}**`);
    } catch (error) {
        console.error('Error fetching birthday:', error);
        await sendReply(context, `\`\`\`Failed to fetch birthday: ${error.message}\`\`\``);
    }
};

export const setTimezone = async (context, args) => {
    const guild = context.guild;
     const authorMember = isMessage(context)
        ? guild.members.cache.get(context.author.id)
        : context.member; 

    if (!authorMember || !authorMember.roles.cache.some(role => role.name === '💥 Mod')) {
        await sendReply(context, "❌ You don't have permission to use this command. Only **💥 Mod** can set timezones.", isInteraction(context));
        return;
    }

     await deferReply(context); 

    let mentionedUser, timezone;

    if (isMessage(context)) {
        if (args.length < 2 || !context.mentions.users.size) {
            await sendReply(context, '❌ Usage: `!settimezone @User <timezone>` (e.g. `!settimezone @Syn Asia/Kolkata` or `UTC+5:30`)');
            return;
        }
        mentionedUser = context.mentions.users.first();
        timezone = args[1];
    } else if (isInteraction(context)) {
        mentionedUser = context.options.getUser('user');
        timezone = context.options.getString('timezone');
    } else {
        await sendReply(context, 'Invalid context.');
        return;
    }

     if (!mentionedUser) {
         await sendReply(context, '❌ Could not find the mentioned user.', isInteraction(context));
         return;
     }

    const validTimezones = Intl.supportedValuesOf?.('timeZone') || [];
    const isIANA = validTimezones.includes(timezone);
    const isUTC = isValidUTCOffset(timezone);

    if (!isIANA && !isUTC) {
        await sendReply(context, `❌ Invalid timezone: \`${timezone}\`. Use a valid IANA name (e.g. Asia/Kolkata) or UTC offset (e.g. UTC+5:30)`, isInteraction(context));
        return;
    }

    try {
        const existing = await TimeZoneModel.findOne({ discordId: mentionedUser.id });

        if (existing) {
            existing.timezone = timezone;
            await existing.save();
            await sendReply(context, `🌍 Updated timezone for **${mentionedUser.username}** to **${timezone}**`);
        } else {
            const newTimezone = new TimeZoneModel({
                discordId: mentionedUser.id,
                timezone
            });
            await newTimezone.save();
            await sendReply(context, `🌍 Set timezone for **${mentionedUser.username}** to **${timezone}**`);
        }
    } catch (error) {
        console.error('Error setting timezone:', error);
        await sendReply(context, `\`\`\`Failed to set timezone: ${error.message}\`\`\``);
    }
};

export const getTime = async (context, args) => {
    let mentionedUser;

    if (isMessage(context)) {
        if (!context.mentions.users.size) {
            await sendReply(context, '❌ Usage: `!time @User`');
            return;
        }
        mentionedUser = context.mentions.users.first();
    } else if (isInteraction(context)) {
         mentionedUser = context.options.getUser('user');
    } else {
         await sendReply(context, 'Invalid context.');
        return;
    }

    if (!mentionedUser) {
         await sendReply(context, '❌ Could not find the mentioned user.', isInteraction(context));
         return;
     }

    await deferReply(context);

    try {
        const userTimeData = await TimeZoneModel.findOne({ discordId: mentionedUser.id });
        if (!userTimeData) {
            await sendReply(context, `❌ No timezone found for **${mentionedUser.username}**. Use \`!settimezone\` to set one.`, isInteraction(context));
            return;
        }

       const userTimezone = userTimeData.timezone;


        const parseTimezone = (tzString) => {

            if (Intl.supportedValuesOf('timeZone')?.includes(tzString)) {
                 return moment.tz(tzString);
            }

            
            if (tzString.startsWith('UTC')) {
                const match = tzString.match(/^UTC([+-])(\d{1,2})(?::(00|15|30|45))?$/);
                if (match && isValidUTCOffset(tzString)) { 
                    const sign = match[1] === '+' ? 1 : -1;
                    const hours = parseInt(match[2]);
                    const minutes = parseInt(match[3] || '0');
                    const totalMinutesOffset = sign * (hours * 60 + minutes);

                    return moment.utc().utcOffset(totalMinutesOffset);

                }
                throw new Error(`Invalid UTC offset format: ${tzString}`);
            }

        
            throw new Error(`Unrecognized timezone format: ${tzString}`);
        };

        
        const userTime = parseTimezone(userTimezone);

        
        await sendReply(context, `🕒 Time for **${mentionedUser.username}**: **${userTime.format('dddd, MMMM Do YYYY, h:mm A')}** (${userTimezone})`);

    } catch (error) {
        console.error('Error fetching time:', error);
        await sendReply(context, `\`\`\`Failed to fetch time: ${error.message}\`\`\``);
    }
};

export const setTwitch = async (context, args) => {
    const guild = context.guild;
    const authorMember = isMessage(context)
       ? guild.members.cache.get(context.author.id)
       : context.member; 

    if (!authorMember || !authorMember.roles.cache.some(role => role.name === '💥 Mod')) {
        await sendReply(context, "❌ You don't have permission to use this command. Only **💥 Mod** can set Twitch links.", isInteraction(context));
        return;
    }

     await deferReply(context); 


    let mentionedUser, twitchUsername;

    if (isMessage(context)) {
        if (args.length < 2 || !context.mentions.users.size) {
            await sendReply(context, '❌ Usage: `!settwitch @MentionUser twitch_username`');
            return;
        }
        mentionedUser = context.mentions.users.first();
        twitchUsername = args[1 + context.mentions.users.size - 1];
    } else if (isInteraction(context)) {
        mentionedUser = context.options.getUser('user');
        twitchUsername = context.options.getString('username');
    } else {
         await sendReply(context, 'Invalid context.');
        return;
    }

     if (!mentionedUser) {
         await sendReply(context, '❌ Could not find the mentioned user.', isInteraction(context));
         return;
     }
     if (!twitchUsername) { 
         await sendReply(context, '❌ Please provide the Twitch username.', isInteraction(context));
         return;
     }


    if (!/^[a-zA-Z0-9_]+$/.test(twitchUsername)) {
        await sendReply(context, '❌ Invalid Twitch username format. Twitch usernames can only contain letters, numbers, and underscores.', isInteraction(context));
        return;
    }

    try {
        // const twitchUsers = await getTwitchUsersByLogin([twitchUsername]);
        // if (twitchUsers.length === 0) {
        //      await sendReply(context, `❌ Twitch user "${twitchUsername}" not found.`, isInteraction(context));
        //      return;
        // }
        // const twitchUserId = twitchUsers[0].id;

        // Save or update the link in the database
        const existingLink = await TwitchLinkModel.findOne({ discordId: mentionedUser.id });

        if (existingLink) {
            if (existingLink.twitchUsername.toLowerCase() === twitchUsername.toLowerCase()) {
                 await sendReply(context, `✅ Twitch link for **${mentionedUser.username}** is already set to **${twitchUsername}**.`);
                return;
            }
            existingLink.twitchUsername = twitchUsername;
            await existingLink.save();
            await sendReply(context, `✅ Updated Twitch link for **${mentionedUser.username}** to **${twitchUsername}**.`);
        } else {
            const newLink = new TwitchLinkModel({
                discordId: mentionedUser.id,
                twitchUsername: twitchUsername
            });
            await newLink.save();
             await sendReply(context, `✅ Set Twitch link for **${mentionedUser.username}** to **${twitchUsername}**.`);
        }

    } catch (error) {
        console.error('Error setting Twitch link:', error);
        await sendReply(context, `❌ Failed to set Twitch link: ${error.message}`);
    }
};

export const getLinkedStreamers = async (context) => {
    const guild = context.guild;
    if (!guild) {
        await sendReply(context, "Guild Not Found!");
        return;
    }

    await deferReply(context); 

    try {
        const twitchLinks = await TwitchLinkModel.find({});

        if (twitchLinks.length === 0) {
            await sendReply(context, "```No Twitch links found in the database.```");
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
        await sendReply(context, response);

    } catch (error) {
        console.error('Error fetching linked streamers:', error);
        await sendReply(context, `\`\`\`Failed to fetch linked streamers: ${error.message}\`\`\``);
    }
};

export const ask = async (context, args) => {
    let question;

    if (isMessage(context)) {
        question = args.join(' ');
        if (!question) {
            await sendReply(context, '❌ Usage: `!ask <your question>`');
            return;
        }
    } else if (isInteraction(context)) {
         question = context.options.getString('question');
         if (!question) { 
              await sendReply(context, '❌ Please provide a question.', isInteraction(context));
              return;
         }
    } else {
        await sendReply(context, 'Invalid context.');
        return;
    }

    const apiKey = process.env.GOOGLE_API;

    if (!apiKey) {
        console.error("GOOGLE_API environment variable not set.");
        await sendReply(context, '```Error: Gemini API key not configured on the server.```');
        return;
    }

    await deferReply(context); 

    try {
        const genAI = new GoogleGenerativeAI(apiKey);


        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        if (isMessage(context)) {
             await context.channel.sendTyping();
        }


        const result = await model.generateContent(question);

        const response = await result.response.text();

         if (!response) {
             await sendReply(context, "I couldn't generate a response for that question.", isInteraction(context));
             return;
         }

        const responseChunks = response.match(/[\s\S]{1,1900}/g) || [];

        if (isInteraction(context)) {
             await context.editReply(responseChunks[0]);
             for (let i = 1; i < responseChunks.length; i++) {
                 await context.followUp(responseChunks[i]);
             }
        } else { 
             for (const chunk of responseChunks) {
                 await context.channel.send(chunk);
             }
        }


    } catch (error) {
        console.error('Error interacting with Gemini API:', error);
         if (isInteraction(context) && (context.deferred || context.replied)) {
              await context.editReply(`\`\`\`Failed to get response: ${error.message}\`\`\``);
         } else {
              await sendReply(context, `\`\`\`Failed to get response: ${error.message}\`\`\``);
         }


        if (error.message.includes('429')) {
             const followUpOrEdit = isInteraction(context) && (context.deferred || context.replied) ? context.followUp : sendReply;
             await followUpOrEdit(context, "Seems like I'm getting too many requests. Please try again later.", isInteraction(context));
        } else if (error.message.includes('403')) {
             const followUpOrEdit = isInteraction(context) && (context.deferred || context.replied) ? context.followUp : sendReply;
             await followUpOrEdit(context, "There was an authentication issue with the API. Check the API key.", isInteraction(context));
        }
    }
};