import TwitchLinkModel from '../../DB/schemas/twitchLinkSchema.mjs';
import { getTwitchUsersByLogin, getLiveStreamsByUserIds } from './twitchAPI.mjs';
import 'dotenv/config';

import { EmbedBuilder } from 'discord.js';


const STREAM_CHECK_INTERVAL = parseInt(process.env.STREAM_CHECK_INTERVAL_MINUTES || '1') * 60 * 1000;
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
    }

    const notificationChannelEnv = LIVE_NOTIFICATION_CHANNEL_ID_ENV ? guild.channels.cache.get(LIVE_NOTIFICATION_CHANNEL_ID_ENV) : null;
     if (LIVE_NOTIFICATION_CHANNEL_ID_ENV && !notificationChannelEnv) {
         console.warn(`Live notification channel from environment variable with ID ${LIVE_NOTIFICATION_CHANNEL_ID_ENV} not found.`);
     }

    const additionalNotificationChannel = guild.channels.cache.get(ADDITIONAL_NOTIFICATION_CHANNEL_ID);
     if (!additionalNotificationChannel) {
        console.warn(`Additional notification channel with ID ${ADDITIONAL_NOTIFICATION_CHANNEL_ID} not found.`);
     }

    const hasNotificationChannels = notificationChannelEnv || additionalNotificationChannel;

    if (!hasNotificationChannels) {
        console.warn('No valid notification channels found. Live notifications will not be sent.');
    }


    try {
        const links = await TwitchLinkModel.find({});

        console.log(`[DEBUG] Found ${links.length} Twitch links in the database.`);
        if (links.length === 0) {
            console.log('No Twitch links found in the database.');

            if (liveRole) {
                 console.log("Removing livenow role from all members as no links exist.");
                 const membersWithRole = await guild.members.fetch({ cache: false }).then(fetchedMembers => 
                     fetchedMembers.filter(member => member.roles.cache.has(liveRole.id))
                 ).catch(console.error);

                 if (membersWithRole) {
                     for (const [memberId, member] of membersWithRole) {
                         try {
                             if (member.roles.cache.has(liveRole.id)) {
                                await member.roles.remove(liveRole); 
                                console.log(`Removed "${LIVENOW_ROLE_NAME}" role from ${member.user.tag} (no links).`);
                             }
                         } catch (err) {
                              console.error(`Failed to remove role from ${member.user.tag} (${memberId}):`, err);
                         }
                     }
                 }
            }
            currentlyLiveDiscordIds = new Set();
            return;
        }

        const twitchUsernames = links.map(link => link.twitchUsername).filter(username => username); 
        if (twitchUsernames.length === 0) {
             console.log('No valid Twitch usernames found in links.');
             currentlyLiveDiscordIds = new Set();
             return;
        }
        const discordIdMap = new Map(links.map(link => [link.twitchUsername.toLowerCase(), link.discordId])); 

        const twitchUsers = await getTwitchUsersByLogin(twitchUsernames);

        console.log(`[DEBUG] Found ${twitchUsers.length} Twitch users for ${twitchUsernames.length} linked usernames.`);
        if (twitchUsers.length === 0) {
             console.warn('Could not find Twitch user IDs for any linked usernames.');


             if (liveRole) {
                  console.log("Removing livenow role from all members as no valid Twitch users found for links.");
                   const membersWithRole = await guild.members.fetch({ cache: false }).then(fetchedMembers => 
                      fetchedMembers.filter(member => member.roles.cache.has(liveRole.id))
                  ).catch(console.error);

                  if (membersWithRole) {
                      for (const [memberId, member] of membersWithRole) {
                          try {
                               if (member.roles.cache.has(liveRole.id)) {
                                   await member.roles.remove(liveRole); 
                                   console.log(`Removed "${LIVENOW_ROLE_NAME}" role from ${member.user.tag} (no valid twitch users).`);
                               }
                          } catch (err) {
                               console.error(`Failed to remove role from ${member.user.tag} (${memberId}):`, err);
                          }
                      }
                  }
             }
             currentlyLiveDiscordIds = new Set();
             return;
        }

        const twitchUserIds = twitchUsers.map(user => user.id);
        const twitchUserIdToLoginMap = new Map(twitchUsers.map(user => [user.id, user.login]));
        const twitchLoginToIdMap = new Map(twitchUsers.map(user => [user.login.toLowerCase(), user.id]));


        console.log('[DEBUG] Twitch User IDs to check for streams:', twitchUserIds);
        console.log('[DEBUG] Twitch User Data:', twitchUsers);

        const liveStreams = await getLiveStreamsByUserIds(twitchUserIds);

        console.log(`[DEBUG] Twitch API returned ${liveStreams.length} live streams.`);
        if (liveStreams.length > 0) {
             console.log('[DEBUG] Details of live streams:', liveStreams.map(s => ({ user_login: s.user_login, user_id: s.user_id, title: s.title, game_name: s.game_name })));
        }

        const currentlyLiveTwitchUserIds = new Set(liveStreams.map(stream => stream.user_id));
        console.log('[DEBUG] currentlyLiveTwitchUserIds set:', currentlyLiveTwitchUserIds);



        if (liveRole) {
            console.log("Checking for members with livenow role who are not live...");
            const membersWithRole = await guild.members.fetch({ cache: false }).then(fetchedMembers => 
                 fetchedMembers.filter(member => member.roles.cache.has(liveRole.id))
            ).catch(console.error);

            if (membersWithRole) {
                 for (const [memberId, member] of membersWithRole) {
                     const linkedTwitchLink = links.find(link => link.discordId === memberId);

                     const twitchUserId = linkedTwitchLink ? twitchLoginToIdMap.get(linkedTwitchLink.twitchUsername.toLowerCase()) : null;


                     const isCurrentlyLive = twitchUserId ? currentlyLiveTwitchUserIds.has(twitchUserId) : false;

                     if (!isCurrentlyLive) {
                          try {
                               console.log(`[DEBUG] Member ${member.user.tag} has role but is not live or link/user not found. Attempting removal.`);
                               if (member.roles.cache.has(liveRole.id)) {
                                   await member.roles.remove(liveRole); 
                                   console.log(`Removed "${LIVENOW_ROLE_NAME}" role from ${member.user.tag} (${memberId}).`);
                               }
                          } catch (err) {
                               console.error(`Failed to remove role from ${member.user.tag} (${memberId}) during cleanup:`, err);
                          }
                     }
                 }
            }
        }


        const previousLiveDiscordIds = new Set(currentlyLiveDiscordIds);
        const nextLiveDiscordIds = new Set();

        const wentLiveDiscordDetails = []; 
        const wentOfflineDiscordDetails = [];


        for (const link of links) {
            const twitchUserId = twitchLoginToIdMap.get(link.twitchUsername.toLowerCase());

            if (!twitchUserId) {
                 console.warn(`[DEBUG] Skipping link for ${link.twitchUsername} (Twitch user not found).`);
                 continue;
            }

            const isLiveNow = currentlyLiveTwitchUserIds.has(twitchUserId);

            if (isLiveNow) {
                nextLiveDiscordIds.add(link.discordId);
                console.log(`[DEBUG] Added Discord ID ${link.discordId} to nextLiveDiscordIds.`);
            }
        }

        console.log(`[DEBUG] Before determining newly live/offline:`);
        console.log(`[DEBUG] previousLiveDiscordIds:`, previousLiveDiscordIds);
        console.log(`[DEBUG] nextLiveDiscordIds:`, nextLiveDiscordIds);


         for (const discordId of nextLiveDiscordIds) {
             if (!previousLiveDiscordIds.has(discordId)) {
                 const link = links.find(l => l.discordId === discordId);
                 if (link) {
                    const twitchUserId = twitchLoginToIdMap.get(link.twitchUsername.toLowerCase());
                    if (twitchUserId) {
                        const streamInfo = liveStreams.find(s => s.user_id === twitchUserId);
                        if (streamInfo) {
                            wentLiveDiscordDetails.push({ discordId: discordId, twitchUsername: link.twitchUsername, streamInfo: streamInfo });
                             console.log(`[DEBUG] User ${link.twitchUsername} (${discordId}) detected as newly live.`);
                        } else {
                            console.warn(`[DEBUG] Stream info not found for newly live Twitch user: ${link.twitchUsername} (ID: ${twitchUserId}). Skipping notification/role for this check.`);
                            nextLiveDiscordIds.delete(discordId); 
                        }
                    } else {
                           console.warn(`[DEBUG] Could not find Twitch user details for newly live Discord ID: ${discordId} (Username: ${link.twitchUsername}). Skipping notification/role.`);
                           nextLiveDiscordIds.delete(discordId); 
                    }
                 } else {
                      console.warn(`[DEBUG] Could not find link details for newly live Discord ID: ${discordId}. Skipping notification/role.`);
                       nextLiveDiscordIds.delete(discordId); 
                 }
             }
         }

         for (const discordId of previousLiveDiscordIds) {
             if (!nextLiveDiscordIds.has(discordId)) {
                  const link = links.find(l => l.discordId === discordId);

                  if (link) {
                     wentOfflineDiscordDetails.push({ discordId: discordId, twitchUsername: link.twitchUsername });
                      console.log(`[DEBUG] User ${link.twitchUsername} (${discordId}) detected as newly offline.`);
                  } else {
                     console.warn(`[DEBUG] Could not find link details for newly offline Discord ID: ${discordId}.`);
                  }
             }
         }


        currentlyLiveDiscordIds = nextLiveDiscordIds; 

        console.log(`Determined newly Live: ${wentLiveDiscordDetails.length}, Determined newly Offline: ${wentOfflineDiscordDetails.length}`);

        for (const { discordId, twitchUsername, streamInfo } of wentLiveDiscordDetails) {
            try {
                console.log(`[DEBUG] Processing newly live user: ${twitchUsername} (${discordId})`);
                const member = await guild.members.fetch({ user: discordId, force: true }).catch((err) => {
                     console.error(`Failed to fetch member ${discordId}:`, err);
                     return null;
                });

                if (!member) {
                    console.warn(`Discord member with ID ${discordId} not found in guild. Cannot assign role or send notification.`);
                     currentlyLiveDiscordIds.delete(discordId); 
                    continue; 
                }

                console.log(`[DEBUG] Fetched Discord member: ${member.user.tag}`);
                let roleAddedSuccessfully = false;

                if (liveRole) {
                    if (!member.roles.cache.has(liveRole.id)) {
                         console.log(`[DEBUG] Member does not have role, attempting to add.`);
                         try {
                             await member.roles.add(liveRole);
                             console.log(`Added "${LIVENOW_ROLE_NAME}" role to ${member.user.tag} (${discordId}).`);
                             roleAddedSuccessfully = true;
                         } catch (roleError) {
                             console.error(`Failed to add "${LIVENOW_ROLE_NAME}" role to ${member.user.tag} (${discordId}):`, roleError);
                             continue;
                         }
                    } else {
                         console.log(`[DEBUG] Member already has the role.`);
                         roleAddedSuccessfully = true; 
                    }
                } else {
                    console.warn(`Live role not found. Skipping role assignment for ${member.user.tag}.`);
                    roleAddedSuccessfully = true; 
                }


                if (roleAddedSuccessfully && hasNotificationChannels) {
                        console.log(`[DEBUG] Role handled successfully, preparing embed.`);

                        const embed = new EmbedBuilder()
                            .setColor('#6441A4') 
                            .setAuthor({
                                name: `${member.displayName || member.user.username} is now live on Twitch! ✨`,
                                iconURL: member.user.displayAvatarURL(),
                                url: `https://twitch.tv/${twitchUsername}`
                            })
                            .setURL(`https://twitch.tv/${twitchUsername}`);

                        if (streamInfo) {
                             console.log(`[DEBUG] Adding stream info to embed for ${twitchUsername}.`);
                            embed.addFields(
                                { name: 'Stream Title', value: streamInfo.title || 'No title provided', inline: false }, 
                                { name: 'Game/Category', value: streamInfo.game_name || 'Not specified', inline: true }
                            );

                            if (streamInfo.thumbnail_url) {
                                const thumbnailUrl = streamInfo.thumbnail_url
                                    .replace('{width}', '400')
                                    .replace('{height}', '225');
                                embed.setImage(thumbnailUrl);
                            }
                            if (streamInfo.viewer_count !== undefined && streamInfo.viewer_count !== null) {
                                embed.addFields({ name: 'Viewers', value: streamInfo.viewer_count.toString(), inline: true });
                            }


                        } else {
                             console.log(`[DEBUG] No stream info available, adding default Go Watch field.`);
                              embed.addFields({ name: 'Go Watch!', value: `https://twitch.tv/${twitchUsername}`, inline: false });
                        }

                        embed.setTimestamp();

                        const messagePayload = { embeds: [embed] };
                         if (liveRole && member.guild.roles.cache.has(liveRole.id)) { 
                              messagePayload.content = `Hey <@&${liveRole.id}>!`;
                              messagePayload.allowedMentions = { roles: [liveRole.id] };
                         }


                        if (notificationChannelEnv) {
                           console.log(`[DEBUG] Sending notification to environment channel ${notificationChannelEnv.id}.`);
                           await notificationChannelEnv.send(messagePayload).catch(console.error);
                        }

                        if (additionalNotificationChannel) {
                            console.log(`[DEBUG] Sending notification to additional channel ${additionalNotificationChannel.id}.`);
                            await additionalNotificationChannel.send(messagePayload).catch(console.error);
                        }
                } else {
                     if (!roleAddedSuccessfully) {
                          console.log(`[DEBUG] Role not added successfully for ${discordId}. Skipping notification.`);
                     } else {
                          console.log(`[DEBUG] Role handled successfully, but no notification channels configured. Skipping notification.`);
                     }
                }
            } catch (error) {
                console.error(`Error processing newly live user ${twitchUsername} (${discordId}):`, error);
                 currentlyLiveDiscordIds.delete(discordId);
            }
        }

        for (const { discordId, twitchUsername } of wentOfflineDiscordDetails) {
            try {
                 console.log(`[DEBUG] Processing newly offline user: ${twitchUsername} (${discordId})`);
                 const member = await guild.members.fetch({ user: discordId, force: true }).catch((err) => {
                     console.error(`Failed to fetch member ${discordId}:`, err);
                     return null;
                 });

                 if (!member) {
                    console.warn(`Discord member with ID ${discordId} not found in guild. Cannot remove role.`);
                    continue; 
                 }

                 console.log(`[DEBUG] Fetched Discord member: ${member.user.tag}`);

                 if (liveRole) { 
                    if (member.roles.cache.has(liveRole.id)) {
                         console.log(`[DEBUG] Member has role and went offline, attempting to remove.`);
                        try {
                            await member.roles.remove(liveRole); 
                            console.log(`Removed "${LIVENOW_ROLE_NAME}" role from ${member.user.tag} (${discordId}).`);
                             // if (hasNotificationChannels) {
                             //    const offlineEmbed = new EmbedBuilder()
                             //        .setColor('#999999') 
                             //        .setDescription(`😔 ${member.displayName || member.user.username} is now offline.`);
                             //    const offlinePayload = { embeds: [offlineEmbed] };
                             //    if (notificationChannelEnv) notificationChannelEnv.send(offlinePayload).catch(console.error);
                             //    if (additionalNotificationChannel) additionalNotificationChannel.send(offlinePayload).catch(console.error);
                             // }
                        } catch (roleError) {
                             console.error(`Failed to remove "${LIVENOW_ROLE_NAME}" role from ${member.user.tag} (${discordId}):`, roleError);
                        }
                    } else {
                         console.log(`${member.user.tag} does not have the role, but marked as went offline. State mismatch or role manually removed?`);
                    }
                 } else {
                     console.log(`Live role not found. Skipping role removal for ${member.user.tag}.`);
                 }

            } catch (error) {
                 console.error(`Error processing newly offline user ${twitchUsername} (${discordId}):`, error);
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