import { addCommand } from '../../commands/commands.mjs';
import { ping, greet, add, listStreamers, setBirthday, getBirthday, setTimezone, getTime, setTwitch} from './synUtils.mjs';

addCommand('ping', 'Replies with Pong!', ping);
addCommand('hello', 'Replies with a greeting!', greet);
addCommand('add', 'Adds two numbers. Usage: `!add 5 10`', add);
addCommand('streamers', 'Lists all users with the "Streamer" role', listStreamers);
addCommand('setbirthday','Set birthday of members', setBirthday);
addCommand('birthday','Get birthday of a member', getBirthday);
addCommand('settimezone','Set the timezone of a user', setTimezone);
addCommand('time', 'Get the current time of the user', getTime);
addCommand('settwitch', 'Set the twitch username of user', setTwitch);

