import mongoose from 'mongoose';
import Logger from "@Utils/Logger";
import DailyWordModel, {type DailyWord} from "@Schemas/DailyWord";

export async function getTodayWord(language: string = 'en-US'): Promise<DailyWord | null> {
    if (!['en-US', 'de'].includes(language)) {
        language = 'en-US';
    }

    const dailyWord = await DailyWordModel.findOne({
        date: new Date().toISOString().split("T")[0],
        language,
    }).lean();

    if (dailyWord) {
        return dailyWord;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    return DailyWordModel.findOne({
        date: yesterday.toISOString().split("T")[0],
        language,
    }).lean();
}

export async function createMongooseConnection() {
    const startAt = Date.now();

    mongoose.connect(process.env.DATABASE_URL, {
        autoIndex: true
    }).catch(e => {
        console.log(e.message)
    });

    mongoose.Promise = global.Promise;

    mongoose.connection.on('err', err => {
        Logger.error(`Mongoose connection error: ${err.stack}`, 'DATABASE');
    });

    mongoose.connection.on('disconnected', () => {
        Logger.warn(`Mongoose connection lost`, 'DATABASE');
    });
    mongoose.connection.on('connected', () => {
        Logger.info(`Mongoose connection done (${Date.now() - startAt}ms)`, 'DATABASE');
    });
}