import fetch from 'node-fetch';
import 'dotenv/config';

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let accessToken = null;
let tokenExpiry = 0;

const getAppAccessToken = async () => {
    const url = `https://id.twitch.tv/oauth2/token`;
    const params = new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
    });

    try {
        const response = await fetch(url, { method: 'POST', body: params });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Twitch token request failed: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        accessToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in * 1000) - 5000; 
        console.log('Successfully obtained new Twitch App Access Token.');
        return accessToken;
    } catch (error) {
        console.error('Error getting Twitch App Access Token:', error);
        accessToken = null;
        tokenExpiry = 0;
        throw error; 
    }
};

const ensureAccessToken = async () => {
    if (!accessToken || Date.now() >= tokenExpiry) {
        await getAppAccessToken();
    }
    if (!accessToken) {
         throw new Error("Failed to obtain Twitch access token.");
    }
    return accessToken;
};

export const getTwitchUsersByLogin = async (logins) => {
    if (!logins || logins.length === 0) return [];

    const token = await ensureAccessToken();
    const url = `https://api.twitch.tv/helix/users?${logins.map(login => `login=${encodeURIComponent(login)}`).join('&')}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
             const errorText = await response.text();
             console.error(`Twitch /users request failed: ${response.status} - ${errorText}`);
             throw new Error(`Twitch API error fetching users: ${response.status}`);
        }

        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('Error fetching Twitch users:', error);
        throw error;
    }
};


export const getLiveStreamsByUserIds = async (userIds) => {
    if (!userIds || userIds.length === 0) return [];

    const token = await ensureAccessToken();
    const maxIdsPerRequest = 100;
    const liveStreams = [];

    for (let i = 0; i < userIds.length; i += maxIdsPerRequest) {
        const batchIds = userIds.slice(i, i + maxIdsPerRequest);
        const url = `https://api.twitch.tv/helix/streams?${batchIds.map(id => `user_id=${encodeURIComponent(id)}`).join('&')}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Client-ID': TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Twitch /streams request failed: ${response.status} - ${errorText}`);
                continue; 
            }

            const data = await response.json();
            liveStreams.push(...data.data);
        } catch (error) {
            console.error('Error fetching Twitch streams batch:', error);
        }
    }

    return liveStreams;
};