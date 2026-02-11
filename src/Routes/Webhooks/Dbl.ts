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

export default class WebhookDBLRoute implements TRoute {
    method = 'POST';
    path = '/webhooks/dbl/:token';

    async execute(req: TIncomingMessage, res: TServerResponse) {
        const params = getParams(req, this);
        if (!params.token) {
            return Response(res, {error: 'Missing token'}, 400);
        }

        const settings = await SettingsModel.findOne({auth_token: params.token, disabled: false});
        if (!settings) {
            return Response(res, {message: 'Vote received (no settings configured)'});
        }

        if (!req.body) {
            return Response(res, {error: 'Invalid body'}, 400);
        }

        const mappedData = {
            type: 'vote',
            user_id: req.body.id,
            entity_id: settings.entity_id,
            entity_type: settings.entity_type,
            platform: 'DiscordBotList.com',
        };

        Logger.info(`Received ${mappedData.type} from ${mappedData.user_id} for ${mappedData.entity_type} ${mappedData.entity_id}`, 'DBL');

        await this.fetchAndSaveUserData(mappedData.user_id);

        await RedisQueue.getInstance().addJob(EWorkerJobs.ComputeVote, {
            user_id: mappedData.user_id,
            server_id: settings.server_id,
            entity_type: mappedData.entity_type,
            entity_id: mappedData.entity_id,
            platform: mappedData.platform,
            is_test: false,
            guild_id: req.body?.metadata ?? req.body?.guild_id ?? req.body?.guildId,
        });

        Logger.info(`Vote queued for processing`, 'DBL');
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
            const user = await bot.rest.get(Routes.user(userId)) as {username: string; global_name: string | null; avatar: string | null};

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
            Logger.error(`Failed to fetch user ${userId}: ${error}`, 'DBL');
        }
    }
}
