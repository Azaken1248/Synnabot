import { addCommand } from '../../commands/commands.mjs';
import { ping, greet, add, listStreamers, setBirthday, getBirthday, setTimezone, getTime, setTwitch, getLinkedStreamers, ask} from './synUtils.mjs';

addCommand('ping', 'Replies with Pong!', ping);
addCommand('hello', 'Replies with a greeting!', greet);
addCommand('add', 'Adds two numbers. Usage: `!add 5 10`', add);
addCommand('streamers', 'Lists all users with the "Streamer" role', listStreamers);
addCommand('setbirthday','Set birthday of members. Usage: `!setbirthday @MentionUser DD M` (Mod only)', setBirthday); 
addCommand('birthday','Get birthday of a member. Usage: `!birthday @user`', getBirthday); 
addCommand('settimezone','Set the timezone of a user. Usage: `!settimezone @User <timezone>` (Mod only)', setTimezone); 
addCommand('time', 'Get the current time of the user. Usage: `!time @User`', getTime); 
addCommand('settwitch', 'Set the twitch username of user. Usage: `!settwitch @MentionUser twitch_username` (Mod only)', setTwitch); 
addCommand('streamlinks', 'Get the list of streamers and their linked twitch IDs', getLinkedStreamers);
addCommand('ask', 'Ask a question to Gemini AI. Usage: `!ask <your question>`', ask);