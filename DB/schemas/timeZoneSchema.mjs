import { Schema, model } from 'mongoose';

const timezoneSchema = new Schema({
    discordId: {
        type: String,
        required: true,
        unique: true,
    },
    timezone: {
        type: String,
        required: true,
    }
});

timezoneSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const TimeZoneModel = model('Timezones', timezoneSchema);

export default TimeZoneModel;
