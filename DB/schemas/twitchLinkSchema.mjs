import mongoose from 'mongoose';

const twitchLinkSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
        unique: true
    },
    twitchUsername: {
        type: String,
        required: true,
        unique: true 
    }
});

const TwitchLinkModel = mongoose.model('TwitchLink', twitchLinkSchema);

export default TwitchLinkModel;