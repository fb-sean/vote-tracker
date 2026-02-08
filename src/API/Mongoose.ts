import mongoose from 'mongoose';
import Logger from "@Utils/Logger";

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