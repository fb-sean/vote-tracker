import {TWorker, IWorkerPayloadData, EWorkerJobs} from "@Types/RedisQueue";
import SettingsModel from "@Schemas/Settings";
import {DiscordClient} from "@API/DiscordClient";
import {ComponentType, MessageFlags, Routes} from "discord-api-types/v10";
import Redis from "@API/RedisCache";
import Logger from "@Utils/Logger";
import type {IDisconnectedTopggWebhookPayload} from "@Types/Workers";
import NoOperation from "@Utils/NoOperation";

export default class DisconnectedTopggWebhookWorker implements TWorker {
    jobName = EWorkerJobs.DisconnectedTopggWebhook;
    maxPerSecond = 20;
    maxDuration = 5000;
    concurrency = 5;

    private readonly PERMISSION_CACHE_TTL = 900;

    async execute(payload: IWorkerPayloadData): Promise<void> {
        const data = payload as unknown as IDisconnectedTopggWebhookPayload;
        const startTime = Date.now();

        let d: any = null;

        try {
            const settings = await SettingsModel.find({entity_id: data.entity_id, entity_type: data.entity_type, disabled: false});
            for (const setting of settings) {
                const channelId = setting.channel_id;
                if (!channelId) {
                    Logger.warn(`No channel configured for ${setting.server_id}`, 'SEND_MESSAGE');

                    return;
                }

                await this.sendWithRateLimit(channelId, {
                    components: [
                        {
                            type: ComponentType.Container,
                            accent_color: 15548997,
                            components: [
                                {
                                    type: ComponentType.TextDisplay,
                                    content: '## ⚠️ Important:\nTop.gg integration got deleted. You will no longer receive any vote notifications until you set it up again.',
                                },
                            ],
                        }
                    ],
                    flags: MessageFlags.IsComponentsV2,
                }).catch(NoOperation);
            }

            await SettingsModel.deleteMany({
                entity_id: data.entity_id,
                entity_type: data.entity_type,
            });

            const duration = Date.now() - startTime;

            Logger.info(`SendMessage completed in ${duration}ms`, 'SEND_MESSAGE');
        } catch (error) {
            Logger.error(`Error in SendMessage: ${error}`, 'SEND_MESSAGE');
            console.log(error);
            console.log(d);
        }
    }

    private async sendWithRateLimit(channelId: string, message: Record<string, unknown>): Promise<void> {
        const bot = DiscordClient.getInstance();

        const permCacheKey = `discord:vt:channel_no_perms:${channelId}`;
        const hasNoPerms = await Redis.getInstance().get<string>(permCacheKey);

        if (hasNoPerms === 'true') {
            Logger.warn(`Channel ${channelId} has no permissions (cached), skipping`, 'SEND_MESSAGE');

            return;
        }

        const rateLimitKey = 'discord:vt:rate_limit:global';
        const maxTokens = 45;
        const refillRate = 45;
        const window = 1000;

        const acquired = await this.acquireToken(rateLimitKey, maxTokens, refillRate, window);

        if (!acquired) {
            await this.sleep(100);

            return this.sendWithRateLimit(channelId, message);
        }

        try {
            await bot.rest.post(Routes.channelMessages(channelId), {
                body: message,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        } catch (error: unknown) {
            const discordError = error as { code?: number; retry_after?: number };
            if (discordError.code === 429) {
                const retryAfter = discordError.retry_after || 1;

                Logger.warn(`Rate limited, waiting ${retryAfter}s`, 'SEND_MESSAGE');

                await Redis.getInstance().set('discord:vt:rate_limited', 'true', Math.ceil(retryAfter));

                await this.sleep(retryAfter * 1000);

                return this.sendWithRateLimit(channelId, message);
            }

            if (discordError.code === 50001 || discordError.code === 50013 || discordError.code === 10003) {
                Logger.warn(`No permissions for channel ${channelId}, caching failure`, 'SEND_MESSAGE');

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
