import type {TCronJob} from "@Types/CronJobs";
import TemporaryRoleModel from "@Schemas/TemporaryRole";
import RedisQueue from "@API/RedisQueue";
import {EWorkerJobs} from "@Types/RedisQueue";
import Logger from "@Utils/Logger";
import axios from "axios";

export default class UpdateServerCountCronJob implements TCronJob {
    time = '*/30 * * * *';

    async execute() {
        const startTime = Date.now();

        try {
            Logger.info('Checking for expired roles', 'CRON_UPDATE_SERVER_COUNT');

            const discordResponse = await axios.get('https://discord.com/api/v10/applications/@me', {
                headers: {
                    Authorization: 'Bot ' + process.env.DISCORD_CLIENT_TOKEN,
                    "Content-Type": "application/json"
                }
            });

            if (!discordResponse.data) {
                Logger.error('Failed to fetch Discord application data', 'CRON_UPDATE_SERVER_COUNT');

                return;
            }

            await axios.post(`https://top.gg/api/bots/${process.env.DISCORD_CLIENT_ID}/stats`, {
                server_count: discordResponse.data.approximate_guild_count,
                shard_count: 1,
            }, {
                headers: {
                    Authorization: process.env.TOP_GG_TOKEN,
                    'Content-Type': 'application/json'
                }
            }).catch(() => {
            });

            const duration = Date.now() - startTime;

            Logger.info(`UpdateServerCount completed in ${duration}ms`, 'CRON_UPDATE_SERVER_COUNT');
        } catch (error) {
            Logger.error(`Error in UpdateServerCount: ${error}`, 'CRON_UPDATE_SERVER_COUNT');
            console.log(error);
        }
    }
};
