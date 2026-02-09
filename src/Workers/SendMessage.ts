import {TWorker, IWorkerPayloadData, EWorkerJobs} from "@Types/RedisQueue";
import SettingsModel from "@Schemas/Settings";
import {DiscordClient} from "@API/DiscordClient";
import {Routes, MessageFlags} from "discord-api-types/v10";
import Redis from "@API/RedisCache";
import Logger from "@Utils/Logger";
import type {ISendMessagePayload, IMessagePlaceholders} from "@Types/Workers";

const IsComponentsV2 = MessageFlags.IsComponentsV2;

export default class SendMessageWorker implements TWorker {
    jobName = EWorkerJobs.SendMessage;
    maxPerSecond = 20;
    maxDuration = 5000;
    concurrency = 5;

    async execute(payload: IWorkerPayloadData): Promise<void> {
        const data = payload as unknown as ISendMessagePayload;
        const startTime = Date.now();

        try {
            Logger.info(`Sending message for ${data.user_id} from ${data.platform}`, 'SEND_MESSAGE');

            const settings = await SettingsModel.findOne({server_id: data.server_id});
            if (!settings) {
                Logger.warn(`Settings not found for ${data.server_id}`, 'SEND_MESSAGE');

                return;
            }

            if (settings.disabled) {
                Logger.info(`Settings ${data.server_id} is disabled, skipping message`, 'SEND_MESSAGE');

                return;
            }

            if (!data.user_exists_in_guild) {
                Logger.info(`User ${data.user_id} not in guild, skipping message`, 'SEND_MESSAGE');

                return;
            }

            const voteMessage = settings.messages.find(m => m.type === 'vote')?.payload;
            const firstVoteMessage = settings.messages.find(m => m.type === 'first-vote')?.payload;

            const messageRaw = data.is_first_vote && firstVoteMessage
                ? firstVoteMessage
                : voteMessage;

            if (!messageRaw) {
                Logger.info(`No message configured for ${data.server_id}`, 'SEND_MESSAGE');

                return;
            }

            const channelId = settings.channel_id;
            if (!channelId) {
                Logger.warn(`No channel configured for ${data.server_id}`, 'SEND_MESSAGE');

                return;
            }

            const parsedMessage = this.parseMessage(messageRaw, data);

            await this.sendWithRateLimit(channelId, parsedMessage);

            const duration = Date.now() - startTime;

            Logger.info(`SendMessage completed in ${duration}ms`, 'SEND_MESSAGE');
        } catch (error) {
            Logger.error(`Error in SendMessage: ${error}`, 'SEND_MESSAGE');
            console.log(error);
        }
    }

    private parseMessage(messageRaw: string, payload: ISendMessagePayload): Record<string, unknown> {
        const placeholders: IMessagePlaceholders = {
            'user.mention': `<@${payload.user_id}>`,
            'user.id': payload.user_id,
            'user.username': payload.user_data?.username || 'Unknown',
            'user.avatar': payload.user_data?.avatar || '',
            'votes.count.all': payload.vote_counts.all,
            'votes.count.month': payload.vote_counts.thisMonth,
            'votes.count.year': payload.vote_counts.thisYear,
            'votes.count.week': payload.vote_counts.thisWeek,
            'votes.streak.current': payload.streak.current,
            'votes.streak.best': payload.streak.best,
            'platform': payload.platform,
            'entity.type': payload.entity_type,
            'entity.id': payload.entity_id,
        };

        try {
            const parsed = JSON.parse(messageRaw);

            if (Array.isArray(parsed)) {
                return {
                    content: this.replacePlaceholders('', placeholders),
                    components: parsed,
                    flags: IsComponentsV2,
                };
            }

            if (parsed.content) {
                parsed.content = this.replacePlaceholders(parsed.content, placeholders);
            }

            return parsed;
        } catch {
            return {
                content: this.replacePlaceholders(messageRaw, placeholders),
            };
        }
    }

    private replacePlaceholders(content: string, placeholders: IMessagePlaceholders): string {
        let result = content;

        for (const [key, value] of Object.entries(placeholders)) {
            const placeholder = `{${key}}`;
            result = result.replaceAll(placeholder, String(value));
        }

        return result;
    }

    private async sendWithRateLimit(channelId: string, message: Record<string, unknown>): Promise<void> {
        const bot = DiscordClient.getInstance();

        const rateLimitKey = 'discord:rate_limit:global';
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
            const err = error as { code?: number; retry_after?: number };
            if (err.code === 429) {
                const retryAfter = err.retry_after || 1;
                Logger.warn(`Rate limited, waiting ${retryAfter}s`, 'SEND_MESSAGE');

                await Redis.getInstance().set('discord:rate_limited', 'true', Math.ceil(retryAfter));

                await this.sleep(retryAfter * 1000);
                return this.sendWithRateLimit(channelId, message);
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
