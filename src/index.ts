import dotenv from 'dotenv';
import Logger from "@Utils/Logger";
import {loadMiddlewares} from "@Utils/MiddlewareLoader";
import {loadRoutes} from "@Utils/RouteLoader";
import createHttpClient from "@API/HttpClient";
import {createMongooseConnection} from "@API/Mongoose";
import {loadCommands} from "@Utils/CommandsLoader";
import {loadWorker} from "@Utils/WorkerLoader";
import {loadCronJobs} from "@Utils/CronJobsLoader";

dotenv.config();

process.env.STARTED_AT = Date.now();

const http = createHttpClient();

createMongooseConnection().then(() => {
    Logger.info('Mongoose connecting...', 'DATABASE');
});

loadCommands().then(() => {
    Logger.info('Commands loaded', 'COMMANDS');
});
loadMiddlewares(http).then(() => {
    Logger.info('Middlewares loaded', 'MIDDLEWARE');
});
loadRoutes(http).then(() => {
    Logger.info('Routes loaded', 'ROUTES');
});
loadWorker().then(() => {
    Logger.info('Workers loaded', 'QUEUE');
});
loadCronJobs().then(() => {
    Logger.info('Cron jobs loaded', 'CRON');
});

http.listen(Number(process.env.PORT) || 3000);

process.on("unhandledRejection", async (reason, p) => {
    Logger.error(`I got a Unhandled Rejection/Catch`, 'PROCESS');
    console.log(reason, p);
});
process.on("uncaughtException", async (err, origin) => {
    Logger.error(`I got a Uncaught Exception/Catch`, 'PROCESS');
    console.log(err, origin);
});