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
import {fetchAndSaveUserData} from "@Utils/Discord";

export default class WebhookDiscordsRoute implements TRoute {
    method = 'POST';
    path = '/webhooks/ds/:token';

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
            user_id: req.body.user,
            entity_id: settings.entity_id,
            entity_type: settings.entity_type,
            platform: 'Discords.com',
        };

        Logger.info(`Received ${mappedData.type} from ${mappedData.user_id} for ${mappedData.entity_type} ${mappedData.entity_id}`, 'Discords');

        await fetchAndSaveUserData(mappedData.user_id);

        await RedisQueue.getInstance().addJob(EWorkerJobs.ComputeVote, {
            user_id: mappedData.user_id,
            server_id: settings.server_id,
            entity_type: mappedData.entity_type,
            entity_id: mappedData.entity_id,
            platform: mappedData.platform,
            is_test: false,
            guild_id: req.body?.metadata ?? req.body?.guild_id ?? req.body?.guildId,
        });

        Logger.info(`Vote queued for processing`, 'Discords');
        return Response(res, {message: 'Vote received'});
    }
}
