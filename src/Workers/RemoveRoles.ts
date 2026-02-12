import {TWorker, IWorkerPayloadData, EWorkerJobs} from "@Types/RedisQueue";
import TemporaryRoleModel from "@Schemas/TemporaryRole";
import {DiscordClient} from "@API/DiscordClient";
import {Routes} from "discord-api-types/v10";
import Redis from "@API/RedisCache";
import Logger from "@Utils/Logger";
import type {IRemoveRolesPayload} from "@Types/Workers";

export default class RemoveRolesWorker implements TWorker {
    jobName = EWorkerJobs.RemoveRoles;
    maxPerSecond = 15;
    maxDuration = 5000;
    concurrency = 5;
    private readonly PERMISSION_CACHE_TTL = 900;

    async execute(payload: IWorkerPayloadData): Promise<void> {
        const data = payload as unknown as IRemoveRolesPayload;
        const startTime = Date.now();

        try {
            await this.removeRoleWithRateLimit(data.guild_id, data.user_id, data.role_id);

            await TemporaryRoleModel.deleteOne({
                guild_id: data.guild_id,
                user_id: data.user_id,
                role_id: data.role_id,
            });

            const duration = Date.now() - startTime;
            Logger.info(`RemoveRoles completed in ${duration}ms`, 'REMOVE_ROLES');
        } catch (error) {
            Logger.error(`Error in RemoveRoles: ${error}`, 'REMOVE_ROLES');
            console.log(error);
        }
    }

    private async removeRoleWithRateLimit(
        guildId: string,
        userId: string,
        roleId: string
    ): Promise<void> {
        const bot = DiscordClient.getInstance();

        const permCacheKey = `discord:vt:guild_remove_role_no_perms:${guildId}`;
        const hasNoPerms = await Redis.getInstance().get<string>(permCacheKey);

        if (hasNoPerms === 'true') {
            Logger.warn(`Guild ${guildId} has no role removal permissions (cached), skipping`, 'REMOVE_ROLES');
            return;
        }

        const rateLimitKey = 'discord:vt:rate_limit:role_removals';
        const maxTokens = 10;
        const refillRate = 10;
        const window = 1000;

        const acquired = await this.acquireToken(rateLimitKey, maxTokens, refillRate, window);

        if (!acquired) {
            await this.sleep(100);
            return this.removeRoleWithRateLimit(guildId, userId, roleId);
        }

        try {
            await bot.rest.delete(
                Routes.guildMemberRole(guildId, userId, roleId)
            );
            Logger.info(`Removed role ${roleId} from ${userId}`, 'REMOVE_ROLES');
        } catch (error: unknown) {
            const discordError = error as { code?: number; retry_after?: number };
            if (discordError.code === 429) {
                const retryAfter = discordError.retry_after || 1;

                Logger.warn(`Rate limited on role removals, waiting ${retryAfter}s`, 'REMOVE_ROLES');

                await Redis.getInstance().set('discord:vt:rate_limited:role_removals', 'true', Math.ceil(retryAfter));

                await this.sleep(retryAfter * 1000);

                return this.removeRoleWithRateLimit(guildId, userId, roleId);
            }

            if (discordError.code === 10007 || discordError.code === 10013) {
                Logger.warn(`User ${userId} or role ${roleId} not found in guild ${guildId}`, 'REMOVE_ROLES');
                return;
            }

            if (discordError.code === 50001 || discordError.code === 50013 || discordError.code === 10011 || discordError.code === 10012) {
                Logger.warn(`No permissions for role removal in guild ${guildId}, caching failure`, 'REMOVE_ROLES');
                await Redis.getInstance().set(permCacheKey, 'true', this.PERMISSION_CACHE_TTL);
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
