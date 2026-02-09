import {TWorker, IWorkerPayloadData, EWorkerJobs} from "@Types/RedisQueue";
import SettingsModel from "@Schemas/Settings";
import {DiscordClient} from "@API/DiscordClient";
import {Routes} from "discord-api-types/v10";
import Redis from "@API/RedisCache";
import Logger from "@Utils/Logger";
import type {IGiveRolesPayload} from "@Types/Workers";

export default class GiveRolesWorker implements TWorker {
    jobName = EWorkerJobs.GiveRoles;
    maxPerSecond = 15;
    maxDuration = 5000;
    concurrency = 5;

    async execute(payload: IWorkerPayloadData): Promise<void> {
        const data = payload as unknown as IGiveRolesPayload;
        const startTime = Date.now();

        try {
            Logger.info(`Processing roles for ${data.user_id}`, 'GIVE_ROLES');

            const settings = await SettingsModel.findOne({server_id: data.server_id});
            if (!settings) {
                Logger.warn(`Settings not found for ${data.server_id}`, 'GIVE_ROLES');

                return;
            }

            if (settings.disabled) {
                Logger.info(`Settings ${data.server_id} is disabled, skipping roles`, 'GIVE_ROLES');

                return;
            }

            const guildId = settings.server_id;
            if (!guildId) {
                Logger.warn(`No guild configured for ${data.server_id}`, 'GIVE_ROLES');

                return;
            }

            const rolesToGive = await this.determineRoles(settings.rewards, data);

            if (rolesToGive.length === 0) {
                Logger.info(`No roles to give for ${data.user_id}`, 'GIVE_ROLES');

                return;
            }

            const userInGuild = await this.checkUserInGuild(guildId, data.user_id);
            if (!userInGuild) {
                Logger.info(`User ${data.user_id} not in guild ${guildId}`, 'GIVE_ROLES');

                return;
            }

            for (const roleId of rolesToGive) {
                await this.giveRoleWithRateLimit(guildId, data.user_id, roleId);
            }

            const duration = Date.now() - startTime;
            Logger.info(`GiveRoles completed in ${duration}ms`, 'GIVE_ROLES');
        } catch (error) {
            Logger.error(`Error in GiveRoles: ${error}`, 'GIVE_ROLES');
            console.log(error);
        }
    }

    private async determineRoles(
        rewards: unknown,
        payload: IGiveRolesPayload
    ): Promise<string[]> {
        const rolesToGive: string[] = [];
        const rewardArray = rewards as Array<{role_id?: string | null; min_votes?: number}>;

        if (rewardArray && rewardArray.length > 0) {
            for (const reward of rewardArray) {
                if (payload.vote_counts.all >= (reward.min_votes || 0)) {
                    if (reward.role_id) {
                        rolesToGive.push(reward.role_id);
                    }
                }
            }
        }

        return rolesToGive;
    }

    private async checkUserInGuild(guildId: string, userId: string): Promise<boolean> {
        try {
            const bot = DiscordClient.getInstance();
            await bot.rest.get(Routes.guildMember(guildId, userId));
            return true;
        } catch {
            return false;
        }
    }

    private async giveRoleWithRateLimit(
        guildId: string,
        userId: string,
        roleId: string
    ): Promise<void> {
        const bot = DiscordClient.getInstance();

        const rateLimitKey = 'discord:rate_limit:roles';
        const maxTokens = 10;
        const refillRate = 10;
        const window = 1000;

        const acquired = await this.acquireToken(rateLimitKey, maxTokens, refillRate, window);

        if (!acquired) {
            await this.sleep(100);
            return this.giveRoleWithRateLimit(guildId, userId, roleId);
        }

        try {
            await bot.rest.put(
                Routes.guildMemberRole(guildId, userId, roleId),
                {}
            );
            Logger.info(`Gave role ${roleId} to ${userId}`, 'GIVE_ROLES');
        } catch (error: unknown) {
            const err = error as { code?: number; retry_after?: number };
            if (err.code === 429) {
                const retryAfter = err.retry_after || 1;
                Logger.warn(`Rate limited on roles, waiting ${retryAfter}s`, 'GIVE_ROLES');

                await Redis.getInstance().set('discord:rate_limited:roles', 'true', Math.ceil(retryAfter));

                await this.sleep(retryAfter * 1000);
                return this.giveRoleWithRateLimit(guildId, userId, roleId);
            }

            if (err.code === 10007 || err.code === 10013) {
                Logger.warn(`User ${userId} or role ${roleId} not found in guild ${guildId}`, 'GIVE_ROLES');
                return;
            }

            throw error;
        }
    }

    private async acquireToken(
        key: string,
        maxTokens: number,
        _refillRate: number,
        _window: number
    ): Promise<boolean> {
        const redis = Redis.getInstance();

        const current = await redis.get<string>(key);
        let tokens = current ? parseFloat(current) : maxTokens;

        if (tokens >= 1) {
            tokens -= 1;
            await redis.set(key, tokens.toString(), 1);
            return true;
        }

        return false;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
