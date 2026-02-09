import type {TCronJob} from "@Types/CronJobs";
import TemporaryRoleModel from "@Schemas/TemporaryRole";
import RedisQueue from "@API/RedisQueue";
import {EWorkerJobs} from "@Types/RedisQueue";
import Logger from "@Utils/Logger";

export default class CheckExpiredRolesCronJob implements TCronJob {
    time = '*/5 * * * *';

    async execute() {
        const startTime = Date.now();

        try {
            Logger.info('Checking for expired roles', 'CRON_EXPIRED_ROLES');

            const now = new Date();

            const expiredRoles = await TemporaryRoleModel.find({
                expires_at: {$lte: now},
            }).limit(1000);

            if (expiredRoles.length === 0) {
                Logger.info('No expired roles found', 'CRON_EXPIRED_ROLES');

                return;
            }

            Logger.info(`Found ${expiredRoles.length} expired roles`, 'CRON_EXPIRED_ROLES');

            for (const expiredRole of expiredRoles) {
                await RedisQueue.getInstance().addJob(EWorkerJobs.RemoveRoles, {
                    guild_id: expiredRole.guild_id,
                    user_id: expiredRole.user_id,
                    role_id: expiredRole.role_id,
                });
            }

            const duration = Date.now() - startTime;

            Logger.info(`CheckExpiredRoles completed in ${duration}ms`, 'CRON_EXPIRED_ROLES');
        } catch (error) {
            Logger.error(`Error in CheckExpiredRoles: ${error}`, 'CRON_EXPIRED_ROLES');
            console.log(error);
        }
    }
};
