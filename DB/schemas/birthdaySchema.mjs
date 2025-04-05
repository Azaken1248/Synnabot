import { Schema, model } from 'mongoose';

const birthdaySchema = new Schema({
    discordId: {
        type: String,
        required: true,
        unique: true,
    },
    day: {
        type: String,
        required: true,
    },
    month: {
        type: String,
        required: true,
    },
    lastWished: {
        type: Date,
        default: null
    }
});

birthdaySchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const BirthdayModel = model('Birthdays', birthdaySchema);

export default BirthdayModel;
