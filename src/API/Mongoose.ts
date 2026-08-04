import mongoose from 'mongoose';
import Logger from "@Utils/Logger";
import TemporaryRoleModel from "@Schemas/TemporaryRole";

export async function createMongooseConnection() {
    const startAt = Date.now();

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

    await mongoose.connect(process.env.DATABASE_URL, {
        autoIndex: true
    });

    await TemporaryRoleModel.syncIndexes();
}
