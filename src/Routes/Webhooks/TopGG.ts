import type {TIncomingMessage, TRoute, TServerResponse} from "@Types/HttpClient";
import crypto from "crypto";
import {getParams, Response} from "@Utils/Http";
import Logger from "@Utils/Logger";
import TopggConnectionModel from "@Schemas/Integrations/Topgg";
import UserDataModel from "@Schemas/UserData";
import SettingsModel from "@Schemas/Settings";
import RedisQueue from "@API/RedisQueue";
import Redis from "@API/RedisCache";
import {EWorkerJobs} from "@Types/RedisQueue";
import {DiscordClient} from "@API/DiscordClient";
import {Routes} from "discord-api-types/v10";

export default class WebhookTopGGRoute implements TRoute {
    method = 'POST';
    path = '/webhooks/top-gg/:token';

    async execute(req: TIncomingMessage, res: TServerResponse) {
        const params = getParams(req, this);
        if (!params.token) {
            return Response(res, {error: 'Missing token'}, 400);
        }

        const connection = await TopggConnectionModel.findOne({internal_webhook_token: params.token});
        if (!connection) {
            return Response(res, {error: 'Invalid token'}, 400);
        }

        if (!req.body) {
            return Response(res, {error: 'Invalid body'}, 400);
        }

        const signatureHeader = req.headers['x-topgg-signature'] as string;
        if (!signatureHeader) {
            Logger.warn('TopGG webhook missing signature', 'TOPGG');

            return Response(res, {error: 'Missing signature'}, 401);
        }

        const parsedSignature = signatureHeader.split(',').map(part => part.split('='));
        const sigObj = Object.fromEntries(parsedSignature);

        const timestamp = sigObj['t'];
        const signature = sigObj['v1'];

        if (!timestamp || !signature) {
            Logger.warn('TopGG webhook invalid signature format', 'TOPGG');

            return Response(res, {error: 'Invalid signature format'}, 400);
        }

        const body = req._rawBody || JSON.stringify(req.body);

        if (!connection.webhook_secret) {
            Logger.error('TopGG connection missing webhook_secret', 'TOPGG');

            return Response(res, {error: 'Configuration error'}, 500);
        }

        const hmac = crypto.createHmac('sha256', connection.webhook_secret);
        const digest = hmac.update(`${timestamp}.${body}`).digest('hex');

        if (signature !== digest) {
            Logger.warn('TopGG webhook invalid signature', 'TOPGG');

            return Response(res, {error: 'Invalid signature'}, 401);
        }

        const type = req.body.type;
        const data = req.body.data;

        let parsedQuery: Record<string, string> = {};
        if (data.query) {
            try {
                parsedQuery = Object.fromEntries(new URLSearchParams(data.query));
            } catch (error) {
                Logger.error(`Failed to parse query parameters: ${error}`, 'TOPGG');
            }
        }

        const mappedData = {
            type: type === 'webhook.test' ? 'test' : 'vote',
            user_id: data.user.platform_id,
            entity_id: data.project.platform_id,
            entity_type: data.project.type,
            platform: 'topgg',
            guild_id: parsedQuery?.guild_id || parsedQuery?.guildId || parsedQuery?.metadata,
        };

        Logger.info(`Received ${mappedData.type} from ${mappedData.user_id} for ${mappedData.entity_type} ${mappedData.entity_id}`, 'TOPGG');

        const settings = await SettingsModel.findOne({
            entity_type: mappedData.entity_type,
            entity_id: mappedData.entity_id,
            disabled: false
        });

        if (!settings) {
            Logger.warn(`No settings found for ${mappedData.entity_type} ${mappedData.entity_id}`, 'TOPGG');

            return Response(res, {message: 'Vote received (no settings configured)'});
        }

        await this.fetchAndSaveUserData(mappedData.user_id);

        await RedisQueue.getInstance().addJob(EWorkerJobs.ComputeVote, mappedData);

        Logger.info(`Vote queued for processing`, 'TOPGG');
        return Response(res, {message: 'Vote received'});
    }

    private async fetchAndSaveUserData(userId: string): Promise<void> {
        try {
            const cacheKey = `discord:vt:user:${userId}`;
            const cached = await Redis.getInstance().get<string>(cacheKey);

            if (cached) {
                return;
            }

            const bot = DiscordClient.getInstance();
            const user = await bot.rest.get(Routes.user(userId)) as {
                username: string;
                global_name: string | null;
                avatar: string | null
            };

            const avatar = user.avatar ? user.avatar.split('/').pop()?.split('.')[0] : null;

            await UserDataModel.findOneAndUpdate(
                {userId: userId},
                {
                    userId: userId,
                    username: user.global_name || user.username,
                    avatar: avatar || '',
                },
                {upsert: true}
            );

            await Redis.getInstance().set(cacheKey, 'true', 900);
        } catch (error) {
            Logger.error(`Failed to fetch user ${userId}: ${error}`, 'TOPGG');
        }
    }
}
