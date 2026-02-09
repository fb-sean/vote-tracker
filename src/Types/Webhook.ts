import {
    APIWebhookEvent,
    APIWebhookEventApplicationAuthorizedData,
    ApplicationWebhookEventType,
    ApplicationWebhookType,
} from "discord-api-types/v10";

export type ApplicationAuthorizedEvent = APIWebhookEvent & {
    type: ApplicationWebhookType.Event;
    event: APIWebhookEventApplicationAuthorizedData;
};

export type ApplicationDeauthorizedEvent = APIWebhookEvent & {
    type: ApplicationWebhookType.Event;
    event: {
        type: ApplicationWebhookEventType.ApplicationDeauthorized;
        data: {
            guild_id: string;
        };
    };
};
