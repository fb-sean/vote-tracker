import type {TIncomingMessage, TRoute, TServerResponse} from "@Types/HttpClient";
import {Response} from "@Utils/Http";
import TopggConnectionModel from "@Schemas/Integrations/Topgg";
import {generateKey} from "@Utils/Key";
import Logger from "@Utils/Logger";
import RedisQueue from "@API/RedisQueue";
import {EWorkerJobs} from "@Types/RedisQueue";
import {verifyTopggIntegrationCallbackSecret} from "@Utils/TopggOAuth";
import type {ITopggIntegrationCreateData, ITopggIntegrationDeleteData} from "@Types/TopggOAuth";

export default class RegisterRoute implements TRoute {
    method = 'POST';
    path = '/integrations/top-gg/register';

    async execute(req: TIncomingMessage, res: TServerResponse) {
        const requestUrl = new URL(req.url || '', process.env.TOP_GG_AUTH_CALLBACK_URL);
        if (!verifyTopggIntegrationCallbackSecret(requestUrl.searchParams.get('secret'))) {
            return Response(res, {
                status: 401,
                message: 'Unauthorized'
            }, 401);
        }

        const requestBody = req.body as unknown;
        if (!isRecord(requestBody) || !['integration.create', 'integration.delete'].includes(String(requestBody.type))) {
            return Response(res, {
                status: 400,
                message: 'Missing or invalid body'
            }, 400);
        }

        const type = requestBody.type;
        const data = requestBody.data;

        if (type === 'integration.create') {
            if (!isTopggIntegrationCreateData(data)) {
                return Response(res, {
                    status: 400,
                    message: 'Missing or invalid integration data'
                }, 400);
            }

            const alreadyExisting = await TopggConnectionModel.findOne({
                project_platform: data.project.platform,
                project_platform_id: data.project.platform_id,
                project_type: data.project.type,
            });
            const internalWebhookToken = alreadyExisting?.internal_webhook_token || generateKey();

            if (alreadyExisting) {
                alreadyExisting.connection_id = data.connection_id;
                alreadyExisting.webhook_secret = data.webhook_secret;
                alreadyExisting.project_id = data.project.id;
                alreadyExisting.project_platform = data.project.platform;
                alreadyExisting.project_platform_id = data.project.platform_id;
                alreadyExisting.project_name = data.project.name;
                alreadyExisting.project_avatar_url = data.project.avatar_url;
                alreadyExisting.project_type = data.project.type;
                alreadyExisting.user_id = data.user.platform_id;
                alreadyExisting.internal_webhook_token = internalWebhookToken;

                await alreadyExisting.save();

                Logger.info(`Refreshed Top.gg integration for ${data.project.platform_id} by ${data.user.platform_id}`, 'INTEGRATIONS');

                return Response(res, {
                    webhook_url: `https://votes.discordbots.xyz/webhooks/top-gg/${internalWebhookToken}`,
                    routes: [
                        'vote.create'
                    ]
                });
            }

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
            if (!isTopggIntegrationDeleteData(data)) {
                return Response(res, {
                    status: 400,
                    message: 'Missing or invalid integration data'
                }, 400);
            }

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

function isTopggIntegrationCreateData(value: unknown): value is ITopggIntegrationCreateData {
    if (!isRecord(value) || !isRecord(value.project) || !isRecord(value.user)) {
        return false;
    }

    return isNonEmptyString(value.connection_id)
        && isNonEmptyString(value.webhook_secret)
        && isNonEmptyString(value.project.id)
        && isNonEmptyString(value.project.platform)
        && isNonEmptyString(value.project.platform_id)
        && ['bot', 'server', 'game'].includes(String(value.project.type))
        && isNonEmptyString(value.user.platform_id)
        && isOptionalString(value.project.name)
        && isOptionalString(value.project.avatar_url)
        && isOptionalString(value.user.id)
        && isOptionalString(value.user.name)
        && isOptionalString(value.user.avatar_url);
}

function isTopggIntegrationDeleteData(value: unknown): value is ITopggIntegrationDeleteData {
    return isRecord(value) && isNonEmptyString(value.connection_id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
    return value === undefined || typeof value === 'string';
}
