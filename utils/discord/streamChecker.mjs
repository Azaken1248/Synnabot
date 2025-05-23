import TwitchLinkModel from '../../DB/schemas/twitchLinkSchema.mjs';
import { getTwitchUsersByLogin, getLiveStreamsByUserIds } from './twtichAPI.mjs';
import 'dotenv/config';

const STREAM_CHECK_INTERVAL = parseInt(process.env.STREAM_CHECK_INTERVAL_MINUTES || '5') * 60 * 1000;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const LIVENOW_ROLE_NAME = process.env.LIVENOW_ROLE_NAME || '🔴 Live Now!';
const LIVE_NOTIFICATION_CHANNEL_ID_ENV = process.env.LIVE_NOTIFICATION_CHANNEL_ID;
const ADDITIONAL_NOTIFICATION_CHANNEL_ID = '1375441523583352952'; 


let currentlyLiveDiscordIds = new Set();
let streamCheckInterval = null;

const checkStreams = async (client) => {
    console.log('Starting Twitch stream check...');
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
        console.error(`Guild with ID ${GUILD_ID} not found! Cannot check streams.`);
        return;
    }

    const liveRole = guild.roles.cache.find(role => role.name === LIVENOW_ROLE_NAME);
    if (!liveRole) {
        console.error(`Role "${LIVENOW_ROLE_NAME}" not found in guild ${guild.name}. Cannot assign live role.`);
        if (currentlyLiveDiscordIds.size > 0) {
             console.warn("Attempting to remove livenow role from previously live streamers, but role not found.");
             currentlyLiveDiscordIds = new Set();
        }
        return;
    }


    const notificationChannelEnv = LIVE_NOTIFICATION_CHANNEL_ID_ENV ? guild.channels.cache.get(LIVE_NOTIFICATION_CHANNEL_ID_ENV) : null;
     if (LIVE_NOTIFICATION_CHANNEL_ID_ENV && !notificationChannelEnv) {
         console.warn(`Live notification channel from environment variable with ID ${LIVE_NOTIFICATION_CHANNEL_ID_ENV} not found.`);
     }

     // Get the additional hardcoded channel
    const additionalNotificationChannel = guild.channels.cache.get(ADDITIONAL_NOTIFICATION_CHANNEL_ID);
     if (!additionalNotificationChannel) {
        console.warn(`Additional notification channel with ID ${ADDITIONAL_NOTIFICATION_CHANNEL_ID} not found.`);
     }


    try {
        const links = await TwitchLinkModel.find({});
        if (links.length === 0) {
            console.log('No Twitch links found in the database.');
            if (currentlyLiveDiscordIds.size > 0) {
                console.log("Removing livenow role from all as no links exist now.");
                for (const discordId of currentlyLiveDiscordIds) {
                    try {
                        const member = await guild.members.fetch(discordId).catch(() => null);
                         if (member && member.roles.cache.has(liveRole.id)) {
                             await member.roles.remove(liveRole).catch(console.error);
                         }
                    } catch (err) {
                         console.error(`Failed to remove role for ${discordId}:`, err);
                    }
                }
                currentlyLiveDiscordIds = new Set();
            }
            return;
        }

        const twitchUsernames = links.map(link => link.twitchUsername);
        // const discordIdMap = new Map(links.map(link => [link.twitchUsername, link.discordId]));

        const twitchUsers = await getTwitchUsersByLogin(twitchUsernames);
        const twitchUserIds = twitchUsers.map(user => user.id);
        // const twitchUserIdToLoginMap = new Map(twitchUsers.map(user => [user.id, user.login]));

        if (twitchUserIds.length === 0) {
             console.warn('Could not find Twitch user IDs for any linked usernames.');
            if (currentlyLiveDiscordIds.size > 0) {
                 console.log("Removing livenow role from all as no Twitch users found for links.");
                 for (const discordId of currentlyLiveDiscordIds) {
                     try {
                         const member = await guild.members.fetch(discordId).catch(() => null);
                          if (member && member.roles.cache.has(liveRole.id)) {
                              await member.roles.remove(liveRole).catch(console.error);
                          }
                     } catch (err) {
                          console.error(`Failed to remove role for ${discordId}:`, err);
                     }
                 }
                 currentlyLiveDiscordIds = new Set();
             }
             return;
        }


        const liveStreams = await getLiveStreamsByUserIds(twitchUserIds);
        const currentlyLiveTwitchUserIds = new Set(liveStreams.map(stream => stream.user_id));

        const previousLiveDiscordIds = new Set(currentlyLiveDiscordIds);
        const nextLiveDiscordIds = new Set();

        const wentLiveDiscordIds = [];
        const wentOfflineDiscordIds = [];


        for (const link of links) {
            const twitchUser = twitchUsers.find(u => u.login === link.twitchUsername);
            if (!twitchUser) {
                 console.warn(`Twitch user ${link.twitchUsername} linked to Discord ID ${link.discordId} not found on Twitch.`);
                 continue;
            }
            const isLiveNow = currentlyLiveTwitchUserIds.has(twitchUser.id);
            const wasLivePreviously = previousLiveDiscordIds.has(link.discordId);

            if (isLiveNow) {
                nextLiveDiscordIds.add(link.discordId);
                if (!wasLivePreviously) {
                    wentLiveDiscordIds.push({ discordId: link.discordId, twitchUsername: link.twitchUsername, streamInfo: liveStreams.find(s => s.user_id === twitchUser.id) }); // User just went live
                }
            } else {
                if (wasLivePreviously) {
                    wentOfflineDiscordIds.push({ discordId: link.discordId, twitchUsername: link.twitchUsername });
                }
            }
        }

        currentlyLiveDiscordIds = nextLiveDiscordIds;

        console.log(`Went Live: ${wentLiveDiscordIds.length}, Went Offline: ${wentOfflineDiscordIds.length}`);

        for (const { discordId, twitchUsername, streamInfo } of wentLiveDiscordIds) {
            try {
                const member = await guild.members.fetch(discordId).catch(() => null);
                if (member) {
                    if (!member.roles.cache.has(liveRole.id)) {
                         await member.roles.add(liveRole);
                         console.log(`Added "${LIVENOW_ROLE_NAME}" role to ${member.user.tag} (${discordId}).`);

                         let messageContent = `🎉 **${member.displayName || member.user.username}** is now live on Twitch!`;
                         if (streamInfo) {
                             messageContent += `\n**Stream Title:** ${streamInfo.title}`;
                             messageContent += `\n**Game:** ${streamInfo.game_name}`;
                             messageContent += `\nWatch here: https://twitch.tv/${twitchUsername}`;
                         } else {
                             messageContent += `\nWatch here: https://twitch.tv/${twitchUsername}`;
                         }

                         if (notificationChannelEnv) {
                            await notificationChannelEnv.send(messageContent).catch(console.error);
                         }

                         if (additionalNotificationChannel) {
                             await additionalNotificationChannel.send(messageContent).catch(console.error);
                         }

                    } else {
                         console.log(`${member.user.tag} already has the role. State mismatch?`);
                    }
                } else {
                    console.warn(`Discord member with ID ${discordId} not found in guild.`);
                }
            } catch (error) {
                console.error(`Failed to add "${LIVENOW_ROLE_NAME}" role to ${discordId}:`, error);
            }
        }

        for (const { discordId, twitchUsername } of wentOfflineDiscordIds) {
            try {
                 const member = await guild.members.fetch(discordId).catch(() => null);
                 if (member) {
                    if (member.roles.cache.has(liveRole.id)) {
                        await member.roles.remove(liveRole);
                        console.log(`Removed "${LIVENOW_ROLE_NAME}" role from ${member.user.tag} (${discordId}).`);
                         // Optional: Send offline notification
                         // if (notificationChannelEnv) { ... }
                         // if (additionalNotificationChannel) { ... }
                    } else {
                         console.log(`${member.user.tag} does not have the role. State mismatch?`);
                    }
                 } else {
                    console.warn(`Discord member with ID ${discordId} not found in guild.`);
                 }
            } catch (error) {
                 console.error(`Failed to remove "${LIVENOW_ROLE_NAME}" role from ${discordId}:`, error);
            }
        }


    } catch (error) {
        console.error('Error during Twitch stream check:', error);
    }
    console.log('Finished Twitch stream check.');
};

export const startStreamLoop = (client) => {
    if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
        console.error("Twitch API credentials (TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET) are not set in .env. Stream checking will not start.");
        return;
    }
     if (!process.env.DISCORD_GUILD_ID) {
        console.error("DISCORD_GUILD_ID is not set in .env. Stream checking will not start.");
        return;
    }


    console.log(`Starting stream check loop every ${STREAM_CHECK_INTERVAL / 1000} seconds.`);

    checkStreams(client);

    streamCheckInterval = setInterval(() => checkStreams(client), STREAM_CHECK_INTERVAL);
};

export const stopStreamLoop = () => {
    if (streamCheckInterval) {
        clearInterval(streamCheckInterval);
        streamCheckInterval = null;
        console.log('Twitch stream check loop stopped.');
    }
};