import {TWorker, IWorkerPayloadData, EWorkerJobs} from "@Types/RedisQueue";
import SettingsModel from "@Schemas/Settings";
import {DiscordClient} from "@API/DiscordClient";
import {Routes} from "discord-api-types/v10";
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
                'bot': 'https://top.gg/bot/' + platform.entity_id,
                'server': 'https://top.gg/server/' + platform.entity_id,
                'game': 'https://top.gg/roblox/game/' + platform.entity_id,
            },
            'dbl': {
                'bot': 'https://discordbotlist.com/bots/' + platform.entity_id,
                'server': 'https://discordbotlist.com/servers/' + platform.entity_id,
            },
            'discords': {
                'bot': 'https://discordbotlist.com/bots/' + platform.entity_id,
                'server': 'https://discordbotlist.com/servers/' + platform.entity_id,
            }
        };

        platformMapping['Top.gg'] = platformMapping['topgg'];
        platformMapping['DiscordBotList.com'] = platformMapping['dbl'];
        platformMapping['Discords.com/bot'] = platformMapping['discords'];

        return (platformMapping[platform.platform]?.[platform.entity_type] || 'https://top.gg') + '?ref=votes';
    }

    private parseMessage(messageRaw: string, payload: ISendMessagePayload): Record<string, unknown> {
        const placeholders: IMessagePlaceholders = {
            'user.mention': `<@${payload.user_id}>`,
            'user.id': payload.user_id,
            'user.username': payload.user_data?.username || 'Unknown',
            'user.avatar': payload.user_data?.avatar || '',
            'user.avatar.animated': payload.user_data?.avatar.startsWith('a_') ? '?anmiated=true' : '',
            'votes.count.all': payload.vote_counts.all,
            'votes.count.month': payload.vote_counts.month,
            'votes.count.year': payload.vote_counts.year,
            'votes.count.week': payload.vote_counts.week,
            'votes.streak.current': payload.streak.current,
            'votes.streak.best': payload.streak.best,
            'votes.streak.last': payload.streak.last,
            'platform': payload.platform,
            'platform.url': this.platformUrl(payload),
            'entity.type': payload.entity_type,
            'entity.id': payload.entity_id,
        };

        try {
            const parsed = JSON.parse(this.replacePlaceholders(messageRaw, placeholders));

            if (Array.isArray(parsed)) {
                let content = '';
                const components: unknown[] = [];

                for (const item of parsed) {
                    if (item.type === 10 && item.content) {
                        content = item.content as string;
                    } else if (item.type === 1 && item.components) {
                        components.push(...item.components);
                    } else if (item.type === 2) {
                        components.push(item);
                    }
                }

                return {
                    content: this.replacePlaceholders(content, placeholders),
                    components: components.length > 0 ? components : undefined,
                    flags: content === '' ? 1 << 15 : undefined,
                };
            }

            if (parsed.content) {
                parsed.content = this.replacePlaceholders(parsed.content as string, placeholders);
            }

            if (parsed.components && !parsed.content && !parsed.embeds) {
                const flags = parsed.flags || 0;

                if (!(flags & (1 << 15))) {
                    parsed.flags = flags | (1 << 15);
                }
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
