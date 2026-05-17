import {TWorker, IWorkerPayloadData, EWorkerJobs} from "@Types/RedisQueue";
import SettingsModel from "@Schemas/Settings";
import {DiscordClient} from "@API/DiscordClient";
import {MessageFlags, Routes} from "discord-api-types/v10";
import Redis from "@API/RedisCache";
import Logger from "@Utils/Logger";
import type {ISendMessagePayload, IMessagePlaceholders} from "@Types/Workers";

export default class SendMessageWorker implements TWorker {
    jobName = EWorkerJobs.SendMessage;
    maxPerSecond = 20;
    maxDuration = 5000;
    concurrency = 5;
    private readonly PERMISSION_CACHE_TTL = 900;

    async execute(payload: IWorkerPayloadData): Promise<void> {
        const data = payload as unknown as ISendMessagePayload;
        const startTime = Date.now();

        let d: any = null;

        try {
            const settings = data.settings;
            if (!settings) {
                Logger.warn(`Settings not found for ${data.server_id}`, 'SEND_MESSAGE');

                return;
            }

            if (settings.disabled) {
                Logger.info(`Settings ${data.server_id} is disabled, skipping message`, 'SEND_MESSAGE');

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

            const parsedMessage = d = this.parseMessage(messageRaw, data);

            await this.sendWithRateLimit(channelId, parsedMessage);

            const duration = Date.now() - startTime;

            Logger.info(`SendMessage completed in ${duration}ms`, 'SEND_MESSAGE');
        } catch (error) {
            Logger.error(`Error in SendMessage: ${error}`, 'SEND_MESSAGE');
            console.log(error);
            console.log(d);
        }
    }

    private platformUrl(platform: ISendMessagePayload): string {
        const platformMapping = {
            // legacy
            'topgg': {
                'bot': 'https://top.gg/bot/' + platform.entity_id + '/vote',
                'server': 'https://top.gg/servers/' + platform.entity_id + '/vote',
                'game': 'https://top.gg/roblox/game/' + platform.entity_id + '/vote',
            },
            'dbl': {
                'bot': 'https://discordbotlist.com/bots/' + platform.entity_id + '/upvote',
                'server': 'https://discordbotlist.com/servers/' + platform.entity_id + '/upvote',
            },
            'discords': {
                'bot': 'https://discords.com/bots/bot/' + platform.entity_id + '/vote',
                'server': 'https://discords.com/servers/' + platform.entity_id + '/upvote',
            }
        };

        platformMapping['Top.gg'] = platformMapping['topgg'];
        platformMapping['DiscordBotList.com'] = platformMapping['dbl'];
        platformMapping['Discords.com/bot'] = platformMapping['discords'];
        platformMapping['Discords.com'] = platformMapping['discords'];

        return (platformMapping[platform.platform]?.[platform.entity_type] || 'https://top.gg') + '?ref=votes';
    }

    private parseMessage(messageRaw: string, payload: ISendMessagePayload): Record<string, unknown> {
        const placeholders: IMessagePlaceholders = {
            'user.mention': `<@${payload.user_id}>`,
            'user.id': payload.user_id,
            'user.username': payload.user_data?.username || 'Unknown',
            'user.avatar': payload.user_data?.avatar || '',
            'user.avatar.animated': payload.user_data?.avatar.startsWith('a_') ? '?animated=true' : '',
            'votes.count.all': payload.vote_counts.all,
            'votes.count.month': payload.vote_counts.month,
            'votes.count.year': payload.vote_counts.year,
            'votes.count.week': payload.vote_counts.week,
            'votes.streak.current': payload.streak.current,
            'votes.streak.best': payload.streak.best,
            'votes.streak.last': payload.streak.last,
            'platform': payload.platform,
            'platform.url': this.platformUrl(payload),
            'new.line': '\n',
            'entity.type': payload.entity_type,
            'entity.id': payload.entity_id,
        };

        try {
            const parsed = JSON.parse(messageRaw);
            const replaced = this.replacePlaceholdersInObject(parsed, placeholders);

            if (Array.isArray(replaced)) {
                return {
                    components: replaced,
                    flags: MessageFlags.SuppressNotifications | MessageFlags.IsComponentsV2,
                };
            }

            if (replaced.components && !replaced.content && !replaced.embeds) {
                const flags = replaced.flags || 0;

                if (!(flags & MessageFlags.IsComponentsV2)) {
                    replaced.flags = flags | MessageFlags.IsComponentsV2;
                }
            }

            return replaced;
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

        result = result.replaceAll('\\n', '\n');

        return result;
    }

    private replacePlaceholdersInObject(obj: unknown, placeholders: IMessagePlaceholders): any {
        if (typeof obj === 'string') {
            return this.replacePlaceholders(obj, placeholders);
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.replacePlaceholdersInObject(item, placeholders));
        }

        if (obj !== null && typeof obj === 'object') {
            const result: Record<string, unknown> = {};

            for (const [key, value] of Object.entries(obj)) {
                result[key] = this.replacePlaceholdersInObject(value, placeholders);
            }

            return result;
        }

        return obj;
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
