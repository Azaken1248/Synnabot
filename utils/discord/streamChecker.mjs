import TwitchLinkModel from '../../DB/schemas/twitchLinkSchema.mjs';
import { getTwitchUsersByLogin, getLiveStreamsByUserIds } from './twitchAPI.mjs';
import 'dotenv/config';

import { EmbedBuilder } from 'discord.js';


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
        console.error(`Role "${LIVENOW_ROLE_NAME}" not found in guild ${guild.name}. Cannot assign/remove live role.`);
        // Cannot clean up roles if the role doesn't exist, so just return.
        return;
    }

    const notificationChannelEnv = LIVE_NOTIFICATION_CHANNEL_ID_ENV ? guild.channels.cache.get(LIVE_NOTIFICATION_CHANNEL_ID_ENV) : null;
     if (LIVE_NOTIFICATION_CHANNEL_ID_ENV && !notificationChannelEnv) {
         console.warn(`Live notification channel from environment variable with ID ${LIVE_NOTIFICATION_CHANNEL_ID_ENV} not found.`);
     }

    const additionalNotificationChannel = guild.channels.cache.get(ADDITIONAL_NOTIFICATION_CHANNEL_ID);
     if (!additionalNotificationChannel) {
        console.warn(`Additional notification channel with ID ${ADDITIONAL_NOTIFICATION_CHANNEL_ID} not found.`);
     }

    if (!notificationChannelEnv && !additionalNotificationChannel) {
        console.warn('No valid notification channels found. Live notifications will not be sent.');
    }


    try {
        const links = await TwitchLinkModel.find({});
        if (links.length === 0) {
            console.log('No Twitch links found in the database.');
            // If no links exist, remove the role from everyone who might have it.
            if (liveRole) { // Only attempt removal if role was found
                 console.log("Removing livenow role from all members as no links exist.");
                 const membersWithRole = await guild.members.fetch({ force: true }).then(fetchedMembers =>
                     fetchedMembers.filter(member => member.roles.cache.has(liveRole.id))
                 ).catch(console.error);

                 if (membersWithRole) {
                     for (const [memberId, member] of membersWithRole) {
                         try {
                             await member.roles.remove(liveRole).catch(console.error);
                             console.log(`Removed "${LIVENOW_ROLE_NAME}" role from ${member.user.tag} (no links).`);
                         } catch (err) {
                              console.error(`Failed to remove role from ${member.user.tag} (${memberId}):`, err);
                         }
                     }
                 }
            }
            currentlyLiveDiscordIds = new Set(); // Ensure the set is empty
            return;
        }

        const twitchUsernames = links.map(link => link.twitchUsername);
        const discordIdMap = new Map(links.map(link => [link.twitchUsername, link.discordId])); // Map for quick lookup

        const twitchUsers = await getTwitchUsersByLogin(twitchUsernames);
        const twitchUserIds = twitchUsers.map(user => user.id);
        const twitchUserIdToLoginMap = new Map(twitchUsers.map(user => [user.id, user.login])); // Map for quick lookup

        if (twitchUserIds.length === 0) {
             console.warn('Could not find Twitch user IDs for any linked usernames.');
             // If no valid Twitch users found, remove the role from everyone.
             if (liveRole) { // Only attempt removal if role was found
                  console.log("Removing livenow role from all members as no valid Twitch users found for links.");
                  const membersWithRole = await guild.members.fetch({ force: true }).then(fetchedMembers =>
                      fetchedMembers.filter(member => member.roles.cache.has(liveRole.id))
                  ).catch(console.error);

                  if (membersWithRole) {
                      for (const [memberId, member] of membersWithRole) {
                          try {
                              await member.roles.remove(liveRole).catch(console.error);
                              console.log(`Removed "${LIVENOW_ROLE_NAME}" role from ${member.user.tag} (no valid twitch users).`);
                          } catch (err) {
                               console.error(`Failed to remove role from ${member.user.tag} (${memberId}):`, err);
                          }
                      }
                  }
             }
             currentlyLiveDiscordIds = new Set(); // Ensure the set is empty
             return;
        }


        const liveStreams = await getLiveStreamsByUserIds(twitchUserIds);
        const currentlyLiveTwitchUserIds = new Set(liveStreams.map(stream => stream.user_id));

        if (liveRole) { 
            console.log("Checking for members with livenow role who are not live...");
            const membersWithRole = await guild.members.fetch({ force: true }).then(fetchedMembers =>
                 fetchedMembers.filter(member => member.roles.cache.has(liveRole.id))
            ).catch(console.error);

            if (membersWithRole) {
                 for (const [memberId, member] of membersWithRole) {
                     const linkedTwitchLink = links.find(link => link.discordId === memberId);

                     if (linkedTwitchLink) {
                          const linkedTwitchUser = twitchUsers.find(user => user.login === linkedTwitchLink.twitchUsername);

                          if (linkedTwitchUser) {
                              const isCurrentlyLive = currentlyLiveTwitchUserIds.has(linkedTwitchUser.id);

                              if (!isCurrentlyLive) {
                                   try {
                                       await member.roles.remove(liveRole).catch(console.error);
                                       console.log(`Removed "${LIVENOW_ROLE_NAME}" role from ${member.user.tag} (cleanup).`);
                                   } catch (err) {
                                        console.error(`Failed to remove role from ${member.user.tag} (${memberId}) during cleanup:`, err);
                                   }
                              }
                          } else {
                                try {
                                    await member.roles.remove(liveRole).catch(console.error);
                                    console.log(`Removed "${LIVENOW_ROLE_NAME}" role from ${member.user.tag} (linked Twitch user not found).`);
                                } catch (err) {
                                     console.error(`Failed to remove role from ${member.user.tag} (${memberId}) during cleanup:`, err);
                                }
                          }
                     } else {
                          try {
                              await member.roles.remove(liveRole).catch(console.error);
                              console.log(`Removed "${LIVENOW_ROLE_NAME}" role from ${member.user.tag} (no link found).`);
                          } catch (err) {
                               console.error(`Failed to remove role from ${member.user.tag} (${memberId}) during cleanup:`, err);
                          }
                     }
                 }
            }
        }


        const previousLiveDiscordIds = new Set(currentlyLiveDiscordIds);
        const nextLiveDiscordIds = new Set();

        const wentLiveDiscordIds = [];
        const wentOfflineDiscordIds = [];


        for (const link of links) {
            const twitchUser = twitchUsers.find(u => u.login === link.twitchUsername);
            if (!twitchUser) {
                 // console.warn(`Twitch user ${link.twitchUsername} linked to Discord ID ${link.discordId} not found on Twitch.`); 
                 continue;
            }
            const isLiveNow = currentlyLiveTwitchUserIds.has(twitchUser.id);

            if (isLiveNow) {
                nextLiveDiscordIds.add(link.discordId);
            }
        }

        for (const discordId of nextLiveDiscordIds) {
             if (!previousLiveDiscordIds.has(discordId)) {
                 const link = links.find(l => l.discordId === discordId);
                 const twitchUser = twitchUsers.find(u => u.login === link.twitchUsername);
                 const streamInfo = liveStreams.find(s => s.user_id === twitchUser.id);
                 wentLiveDiscordIds.push({ discordId: discordId, twitchUsername: link.twitchUsername, streamInfo: streamInfo });
             }
        }

         for (const discordId of previousLiveDiscordIds) {
             if (!nextLiveDiscordIds.has(discordId)) {
                  const link = links.find(l => l.discordId === discordId);
                  wentOfflineDiscordIds.push({ discordId: discordId, twitchUsername: link.twitchUsername });
             }
         }


        currentlyLiveDiscordIds = nextLiveDiscordIds;

        console.log(`Determined newly Live: ${wentLiveDiscordIds.length}, Determined newly Offline: ${wentOfflineDiscordIds.length}`);


        for (const { discordId, twitchUsername, streamInfo } of wentLiveDiscordIds) {
            try {
                const member = await guild.members.fetch(discordId).catch(() => null);
                if (member) {
                    if (!member.roles.cache.has(liveRole.id)) {
                         await member.roles.add(liveRole).catch(console.error);
                         console.log(`Added "${LIVENOW_ROLE_NAME}" role to ${member.user.tag} (${discordId}).`);
                    }

                    if (notificationChannelEnv || additionalNotificationChannel) {
                        const embed = new EmbedBuilder()
                            .setColor('#6441A4')
                            .setAuthor({
                                name: `${member.displayName || member.user.username} is now live on Twitch! ✨`,
                                iconURL: member.user.displayAvatarURL(),
                                url: `https://twitch.tv/${twitchUsername}`
                            })
                            .setURL(`https://twitch.tv/${twitchUsername}`);

                        if (streamInfo) {
                            embed.addFields(
                                { name: 'Stream Title', value: streamInfo.title, inline: false },
                                { name: 'Game/Category', value: streamInfo.game_name || 'Not specified', inline: true }
                            );

                            if (streamInfo.thumbnail_url) {
                                const thumbnailUrl = streamInfo.thumbnail_url
                                    .replace('{width}', '400')
                                    .replace('{height}', '225');
                                embed.setImage(thumbnailUrl);
                            }
                            if (streamInfo.viewer_count !== undefined) {
                                embed.addFields({ name: 'Viewers', value: streamInfo.viewer_count.toString(), inline: true });
                            }


                        } else {
                              embed.addFields({ name: 'Go Watch!', value: `https://twitch.tv/${twitchUsername}`, inline: false });
                        }

                        embed.setTimestamp();

                        const messagePayload = { embeds: [embed] };

                        if (notificationChannelEnv) {
                           await notificationChannelEnv.send(messagePayload).catch(console.error);
                        }

                        if (additionalNotificationChannel) {
                            await additionalNotificationChannel.send(messagePayload).catch(console.error);
                        }
                    }
                } else {
                    console.warn(`Discord member with ID ${discordId} not found in guild.`);
                     currentlyLiveDiscordIds.delete(discordId);
                }
            } catch (error) {
                console.error(`Failed to add "${LIVENOW_ROLE_NAME}" role or send notification for ${discordId}:`, error);
            }
        }

        for (const { discordId, twitchUsername } of wentOfflineDiscordIds) {
            try {
                 const member = await guild.members.fetch(discordId).catch(() => null);
                 if (member) {
                    if (member.roles.cache.has(liveRole.id)) {
                        await member.roles.remove(liveRole).catch(console.error);
                        console.log(`Removed "${LIVENOW_ROLE_NAME}" role from ${member.user.tag} (${discordId}).`);
                         // Optional: Send offline notification (would also typically be an embed)
                         // if (notificationChannelEnv || additionalNotificationChannel) {
                         //    const offlineEmbed = new EmbedBuilder()
                         //        .setColor('#999999') // Grey color for offline
                         //        .setDescription(`😔 ${member.displayName || member.user.username} is now offline.`);
                         //    const offlinePayload = { embeds: [offlineEmbed] };
                         //    if (notificationChannelEnv) notificationChannelEnv.send(offlinePayload).catch(console.error);
                         //    if (additionalNotificationChannel) additionalNotificationChannel.send(offlinePayload).catch(console.error);
                         // }
                    } else {
                         console.log(`${member.user.tag} does not have the role, but marked as went offline. State mismatch?`);
                    }
                 } else {
                    console.warn(`Discord member with ID ${discordId} not found in guild.`);
                     currentlyLiveDiscordIds.delete(discordId);
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


    console.log(`Starting stream check loop every ${STREAM_CHECK_INTERVAL / 1000 / 60} minutes.`);
    console.log(`Using Guild ID: ${GUILD_ID}`);
     if (LIVE_NOTIFICATION_CHANNEL_ID_ENV) console.log(`Using Notification Channel (Env): ${LIVE_NOTIFICATION_CHANNEL_ID_ENV}`);
     console.log(`Using Notification Channel (Additional): ${ADDITIONAL_NOTIFICATION_CHANNEL_ID}`);


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