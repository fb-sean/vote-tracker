import type {TIncomingMessage, TRoute, TServerResponse} from "@Types/HttpClient";
import axios from "axios";
import {Response} from "@Utils/Http";
import {connectTopggIntegration, consumeTopggOAuthState, TopggOAuthError} from "@Utils/TopggOAuth";
import type {ITopggApiError} from "@Types/TopggOAuth";
import Logger from "@Utils/Logger";
import TopggConnectionModel from "@Schemas/Integrations/Topgg";

export default class TopggCallbackRoute implements TRoute {
    method = 'GET';
    path = '/integrations/top-gg/callback';

    async execute(req: TIncomingMessage, res: TServerResponse) {
        const requestUrl = new URL(req.url || '', process.env.TOP_GG_AUTH_CALLBACK_URL);
        const oauthStateId = requestUrl.searchParams.get('state');

        if (!oauthStateId || !/^[a-f0-9]{64}$/.test(oauthStateId)) {
            return Response(res, 'Missing or invalid OAuth state. Return to Discord and try again.', 400);
        }

        const oauthState = await consumeTopggOAuthState(oauthStateId);
        if (!oauthState) {
            return Response(res, 'This authorization request expired or was already used. Return to Discord and try again.', 400);
        }

        const oauthError = requestUrl.searchParams.get('error');
        if (oauthError) {
            return Response(res, oauthError === 'access_denied'
                ? 'Top.gg authorization was cancelled. Return to Discord to use the manual setup guide.'
                : 'Top.gg could not authorize this setup. Return to Discord and try again.', 400);
        }

        const authorizationCode = requestUrl.searchParams.get('code');
        if (!authorizationCode) {
            return Response(res, 'Missing authorization code. Return to Discord and try again.', 400);
        }

        try {
            const project = await connectTopggIntegration(authorizationCode, oauthState);
            const connection = await TopggConnectionModel.findOne({
                project_type: oauthState.entity_type,
                project_platform_id: oauthState.entity_id,
            });

            if (!connection) {
                throw new TopggOAuthError('Top.gg reports that Votes is connected, but the local connection is missing. Disconnect Votes on Top.gg and try again.');
            }

            if (connection.user_id !== oauthState.user_id) {
                throw new TopggOAuthError('The Votes integration is connected by another Discord account. Disconnect it on Top.gg and try again with this account.');
            }

            Logger.info(`Connected Top.gg integration for ${project.type} ${project.platform_id}`, 'TOPGG_OAUTH');

            return Response(res, 'The Votes integration was connected successfully. Return to Discord and finish the setup.');
        } catch (error: unknown) {
            if (error instanceof TopggOAuthError) {
                return Response(res, error.message, 400);
            }

            const topggError = axios.isAxiosError<ITopggApiError>(error)
                ? error.response?.data.error_description || error.response?.data.detail || error.response?.data.title || error.message
                : error instanceof Error ? error.message : 'Unknown error';

            Logger.error(`Top.gg OAuth setup failed: ${topggError}`, 'TOPGG_OAUTH');

            return Response(res, 'Top.gg could not connect the Votes integration. Return to Discord and try again or use the manual setup guide.', 502);
        }
    }
}
