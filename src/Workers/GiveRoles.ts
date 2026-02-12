import {TWorker, IWorkerPayloadData, EWorkerJobs} from "@Types/RedisQueue";
import SettingsModel, {Settings} from "@Schemas/Settings";
import TemporaryRoleModel from "@Schemas/TemporaryRole";
import {DiscordClient} from "@API/DiscordClient";
import {Routes} from "discord-api-types/v10";
import Redis from "@API/RedisCache";
import RedisQueue from "@API/RedisQueue";
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
            const settings = data.settings;
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

            for (const roleToGive of rolesToGive) {
                await this.giveRoleWithRateLimit(guildId, data.user_id, roleToGive.roleId, roleToGive.durationMin);
            }

            const duration = Date.now() - startTime;
            Logger.info(`GiveRoles completed in ${duration}ms`, 'GIVE_ROLES');
        } catch (error) {
            Logger.error(`Error in GiveRoles: ${error}`, 'GIVE_ROLES');
            console.log(error);
        }
    }

    private async determineRoles(
        rewards: Settings['rewards'],
        payload: IGiveRolesPayload
    ): Promise<Array<{roleId: string; durationMin: number}>> {
        const rolesToGive: Array<{roleId: string; durationMin: number}> = [];

        if (rewards && rewards.length > 0) {
            for (const reward of rewards) {
                if (payload.vote_counts.all >= (reward.min_votes || 0)) {
                    if (reward.role_id) {
                        rolesToGive.push({
                            roleId: reward.role_id,
                            durationMin: reward.duration_min || 0,
                        });
                    }
                }
            }
        }

        return rolesToGive;
    }

    private async checkUserInGuild(guildId: string, userId: string): Promise<boolean> {
        try {
            const cacheKey = `discord:vt:user_in_guild:${guildId}:${userId}`;
            const cached = await Redis.getInstance().get<string>(cacheKey);

            if (cached !== null) {
                return cached === 'true';
            }

            await DiscordClient.getInstance().rest.get(Routes.guildMember(guildId, userId));

            await Redis.getInstance().set(cacheKey, 'true', 900);

            return true;
        } catch {
            return false;
        }
    }

    private async giveRoleWithRateLimit(
        guildId: string,
        userId: string,
        roleId: string,
        durationMin: number
    ): Promise<void> {
        const bot = DiscordClient.getInstance();

        const permCacheKey = `discord:vt:guild_role_no_perms:${guildId}`;
        const hasNoPerms = await Redis.getInstance().get<string>(permCacheKey);

        if (hasNoPerms === 'true') {
            Logger.warn(`Guild ${guildId} has no role permissions (cached), skipping`, 'GIVE_ROLES');

            return;
        }

        const rateLimitKey = 'discord:vt:rate_limit:roles';
        const maxTokens = 10;
        const refillRate = 10;
        const window = 1000;

        const acquired = await this.acquireToken(rateLimitKey, maxTokens, refillRate, window);

        if (!acquired) {
            await this.sleep(100);

            return this.giveRoleWithRateLimit(guildId, userId, roleId, durationMin);
        }

        try {
            await bot.rest.put(
                Routes.guildMemberRole(guildId, userId, roleId),
                {}
            );
            Logger.info(`Gave role ${roleId} to ${userId}`, 'GIVE_ROLES');

            if (durationMin > 0) {
                const expiresAt = new Date(Date.now() + durationMin * 60 * 1000);

                await TemporaryRoleModel.create({
                    guild_id: guildId,
                    user_id: userId,
                    role_id: roleId,
                    expires_at: expiresAt,
                });

                Logger.info(`Scheduled role removal for ${roleId} from ${userId} at ${expiresAt.toISOString()}`, 'GIVE_ROLES');
            }
        } catch (error: unknown) {
            const discordError = error as { code?: number; retry_after?: number };
            if (discordError.code === 429) {
                const retryAfter = discordError.retry_after || 1;

                Logger.warn(`Rate limited on roles, waiting ${retryAfter}s`, 'GIVE_ROLES');

                await Redis.getInstance().set('discord:vt:rate_limited:roles', 'true', Math.ceil(retryAfter));

                await this.sleep(retryAfter * 1000);

                return this.giveRoleWithRateLimit(guildId, userId, roleId, durationMin);
            }

            if (discordError.code === 10007 || discordError.code === 10013) {
                Logger.warn(`User ${userId} or role ${roleId} not found in guild ${guildId}`, 'GIVE_ROLES');

                return;
            }

            if (discordError.code === 50001 || discordError.code === 50013 || discordError.code === 10011 || discordError.code === 10012) {
                Logger.warn(`No permissions for roles in guild ${guildId}, caching failure`, 'GIVE_ROLES');

                await Redis.getInstance().set(permCacheKey, 'true', 900);

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
