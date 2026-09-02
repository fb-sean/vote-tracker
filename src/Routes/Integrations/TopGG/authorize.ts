import type {TIncomingMessage, TRoute, TServerResponse} from "@Types/HttpClient";
import {Redirect, Response} from "@Utils/Http";
import {getSetupState} from "@Utils/SetupManager";
import {createTopggAuthorizationUrl} from "@Utils/TopggOAuth";
import Logger from "@Utils/Logger";

export default class TopggAuthorizeRoute implements TRoute {
    method = 'GET';
    path = '/integrations/top-gg/authorize';

    async execute(req: TIncomingMessage, res: TServerResponse) {
        const requestUrl = new URL(req.url || '', process.env.TOP_GG_AUTH_CALLBACK_URL);
        const setupId = requestUrl.searchParams.get('setup_id');

        if (!setupId || !/^[a-f0-9]{32}$/.test(setupId)) {
            return Response(res, 'Invalid setup session.', 400);
        }

        const setupState = await getSetupState(setupId);
        if (!setupState || !setupState.entity_id || !setupState.entity_type) {
            return Response(res, 'This setup session expired. Return to Discord and start over.', 410);
        }

        try {
            const authorizationUrl = await createTopggAuthorizationUrl(setupId, setupState);

            return Redirect(res, authorizationUrl);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            Logger.error(`Could not start Top.gg OAuth setup: ${errorMessage}`, 'TOPGG_OAUTH');

            return Response(res, 'Top.gg authorization could not be started. Return to Discord and use the manual setup guide.', 500);
        }
    }
}
