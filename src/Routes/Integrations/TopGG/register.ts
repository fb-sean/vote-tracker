import type {TIncomingMessage, TRoute, TServerResponse} from "@Types/HttpClient";
import {Response} from "@Utils/Http";
import TopggConnectionModel from "@Schemas/Integrations/Topgg";
import {generateKey} from "@Utils/Key";
import Logger from "@Utils/Logger";
import RedisQueue from "@API/RedisQueue";
import {EWorkerJobs} from "@Types/RedisQueue";

export default class RegisterRoute implements TRoute {
    method = 'POST';
    path = '/integrations/top-gg/register';

    async execute(req: TIncomingMessage, res: TServerResponse) {
        if (!req.body || !['integration.create', 'integration.delete'].includes(req.body.type)) {
            return Response(res, {
                status: 400,
                message: 'Missing or invalid body'
            }, 400);
        }

        const type = req.body.type;
        const data = req.body.data;

        if (!data) {
            return Response(res, {
                status: 400,
                message: 'Missing data'
            }, 400);
        }

        if (!type) {
            return Response(res, {
                status: 400,
                message: 'Missing type'
            }, 400);
        }

        if (type === 'integration.create') {
            const alreadyExisting = await TopggConnectionModel.findOne({
                project_platform: data.project.platform,
                project_platform_id: data.project.platform_id,
                project_type: data.project.type,
            });

            if (alreadyExisting) {
                Logger.info(`Top.gg integration already registered for ${data.project.platform_id} by ${data.user.platform_id}`, 'INTEGRATIONS');

                return Response(res, {
                    webhook_url: `https://votes.discordbots.xyz/webhooks/top-gg/${alreadyExisting.internal_webhook_token}`,
                    routes: [
                        'vote.create'
                    ]
                });
            }

            const internalWebhookToken = generateKey();

            await TopggConnectionModel.create({
                connection_id: data.connection_id,
                webhook_secret: data.webhook_secret,
                project_id: data.project.id,
                project_platform: data.project.platform,
                project_platform_id: data.project.platform_id,
                project_name: data.project.name,
                project_avatar_url: data.project.avatar_url,
                project_type: data.project.type,
                user_id: data.user.platform_id,
                internal_webhook_token: internalWebhookToken
            });

            Logger.info(`Registered Top.gg integration for ${data.project.platform_id} by ${data.user.platform_id}`, 'INTEGRATIONS');

            return Response(res, {
                webhook_url: `https://votes.discordbots.xyz/webhooks/top-gg/${internalWebhookToken}`,
                routes: [
                    'vote.create'
                ]
            });
        } else if (type === 'integration.delete') {
            const oldConnection = await TopggConnectionModel.findOne({connection_id: data.connection_id});
            if (!oldConnection) {
                return Response(res, {
                    status: 404,
                    message: 'Not found'
                }, 404);
            }

            await TopggConnectionModel.deleteOne({connection_id: data.connection_id});

            await RedisQueue.getInstance().addJob(EWorkerJobs.DisconnectedTopggWebhook, {
                entity_id: oldConnection.project_platform_id,
                entity_type: oldConnection.project_type,
            });

            return Response(res, {
                status: 200,
                message: 'Successfully unregistered'
            });
        }

        return Response(res, {
            status: 400,
            message: 'Invalid request'
        }, 400);
    }
}