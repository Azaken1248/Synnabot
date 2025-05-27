import BirthdayModel from '../../DB/schemas/birthdaySchema.mjs';

const WISHED_TODAY = new Set();

export const birthdayChecker = async (client) => {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let channel;
    try {
        channel = await client.channels.fetch('885916473422381139');
        if (!channel || !channel.isTextBased()) {
            console.warn("Birthday channel not found or not text-based.");
            return;
        }
    } catch (err) {
        console.error("Error fetching birthday channel:", err);
        return;
    }

    try {
        const birthdays = await BirthdayModel.find({ day: day + "", month : month + "" });
        if (!birthdays.length) return;

        for (const birthday of birthdays) {
            if (birthday.day != day || birthday.month != month) continue;
            console.log(WISHED_TODAY.has(birthday.discordId + ""));
            if (WISHED_TODAY.has(birthday.discordId)) continue;

            if (birthday.lastWished && birthday.lastWished.toDateString() === today.toDateString()) continue;

            try {
                const user = await client.users.fetch(birthday.discordId);
                if (!user) continue;

                await channel.send(`🎉 Happy Birthday, <@${user.id}>! Hope you have a fantastic day! 🎂`);

                birthday.lastWished = today;
                await birthday.save();

                WISHED_TODAY.add(birthday.discordId);
            } catch (userError) {
                console.error(`Failed to wish user ${birthday.discordId}:`, userError);
            }
        }
    } catch (error) {
        console.error('Birthday check failed:', error);
    }
};

export const startBirthdayLoop = (client) => {
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 0 && now.getMinutes() === 0) {
            console.log("Resetting WISHED_TODAY set");
            WISHED_TODAY.clear();
        }
    }, 60 * 1000);

    setInterval(() => birthdayChecker(client), 60 * 60 * 1000);
};
