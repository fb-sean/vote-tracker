import type {Middleware, TIncomingMessage, TMiddlewareNext, TServerResponse} from "@Types/HttpClient";
import {verifyKey} from 'discord-interactions';
import {getHeaders, Response} from "@Utils/Http";
import {InteractionType, InteractionResponseType} from "discord-api-types/v10";
import Logger from "@Utils/Logger";

export default class InteractionMiddleware implements Middleware {
    path = '/discord/interaction';

    async execute(req: TIncomingMessage, res: TServerResponse, next: TMiddlewareNext) {
        const headers = getHeaders(req);

        if (!req._rawBody || !await verifyKey(Buffer.from(req._rawBody), headers['x-signature-ed25519'], headers['x-signature-timestamp'], process.env.DISCORD_CLIENT_PUBLIC_KEY)) {
            Response(res, {error: 'Invalid request signature'}, 401)

            Logger.error('Invalid request signature', 'INTERACTIONS');

            return next(false);
        }

        if (req.body && req.body.type === InteractionType.Ping) {
            Response(res, {type: InteractionResponseType.Pong});

            return next(false);
        }


        next(true);
    }
}