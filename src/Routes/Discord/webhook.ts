import type {TIncomingMessage, TRoute, TServerResponse} from "@Types/HttpClient";
import {verifyKey} from 'discord-interactions';
import {Response} from "@Utils/Http";
import Logger from "@Utils/Logger";
import SettingsModel from "@Schemas/Settings";
import {
    APIWebhookEvent,
    ApplicationWebhookEventType,
    ApplicationWebhookType,
} from "discord-api-types/v10";
import type {ApplicationAuthorizedEvent, ApplicationDeauthorizedEvent} from "@Types/Webhook";

export default class WebhookRoute implements TRoute {
    method = 'POST';
    path = '/discord/webhook';

    async execute(req: TIncomingMessage, res: TServerResponse) {
        const signature = req.headers['x-signature-ed25519'] as string;
        const timestamp = req.headers['x-signature-timestamp'] as string;

        if (!signature || !timestamp) {
            Logger.warn('Missing webhook signature headers', 'WEBHOOK');

            return Response(res, {error: 'Missing signature headers'}, 401);
        }

        if (!req._rawBody) {
            Logger.warn('Missing raw body for verification', 'WEBHOOK');

            return Response(res, {error: 'Missing body'}, 400);
        }

        const isValid = await verifyKey(
            Buffer.from(req._rawBody),
            signature,
            timestamp,
            process.env.DISCORD_CLIENT_PUBLIC_KEY
        );

        if (!isValid) {
            Logger.warn('Invalid webhook signature', 'WEBHOOK');

            return Response(res, {error: 'Invalid signature'}, 401);
        }

        const event = req.body as APIWebhookEvent;

        if (event.type === ApplicationWebhookType.Ping) {
            return Response(res, null, 204);
        }

        if (event.type === ApplicationWebhookType.Event) {
            const evt = event as unknown as { event: { type: ApplicationWebhookEventType; data: any } };

            if (evt.event.type === ApplicationWebhookEventType.ApplicationAuthorized) {
                return this.handleAuthorized(event as ApplicationAuthorizedEvent, res);
            }

            if (evt.event.type === ApplicationWebhookEventType.ApplicationDeauthorized) {
                return this.handleDeauthorized(event as ApplicationDeauthorizedEvent, res);
            }

            // @ts-expect-event - We've handled all known events
            Logger.warn(`Unhandled webhook event type: ${(evt.event as { type: string }).type}`, 'WEBHOOK');

            return Response(res, {message: 'Event acknowledged but not handled'}, 202);
        }

        // @ts-expect-event - We've handled all known types
        Logger.warn(`Unhandled webhook payload type: ${(event as { type: string }).type}`, 'WEBHOOK');

        return Response(res, {error: 'Unknown event type'}, 400);
    }

    private async handleAuthorized(event: ApplicationAuthorizedEvent, res: TServerResponse) {
        const guildId = event.event?.guild?.id;

        if (!guildId) {
            Logger.warn('APPLICATION_AUTHORIZED event missing guild_id', 'WEBHOOK');
            return Response(res, {error: 'Missing guild_id'}, 400);
        }

        Logger.info(`Application authorized in guild ${guildId}`, 'WEBHOOK');

        const result = await SettingsModel.updateMany(
            {server_id: guildId},
            {$set: {disabled: false}}
        );

        Logger.info(`Re-enabled ${result.modifiedCount} setup(s) for guild ${guildId}`, 'WEBHOOK');

        return Response(res, {message: 'Authorized', updated: result.modifiedCount});
    }

    private async handleDeauthorized(event: ApplicationDeauthorizedEvent, res: TServerResponse) {
        const guildId = event.event?.data?.guild_id;

        if (!guildId) {
            Logger.warn('APPLICATION_DEAUTHORIZED event missing guild_id', 'WEBHOOK');
            return Response(res, {error: 'Missing guild_id'}, 400);
        }

        Logger.info(`Application deauthorized in guild ${guildId}`, 'WEBHOOK');

        const result = await SettingsModel.updateMany(
            {server_id: guildId},
            {$set: {disabled: true}}
        );

        Logger.info(`Disabled ${result.modifiedCount} setup(s) for guild ${guildId}`, 'WEBHOOK');

        return Response(res, {message: 'Deauthorized', disabled: result.modifiedCount});
    }
}
