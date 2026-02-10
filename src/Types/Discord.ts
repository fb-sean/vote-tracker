import {Context} from "@Utils/Context";
import {APIApplicationCommand} from "discord-api-types/v10";

export type TErrorResponse = { error: string; error_description: string };

export function isErrorResponse(data: any): data is TErrorResponse {
    return typeof data.error === 'string' && typeof data.error_description === 'string';
}

export type TDiscordUserAuthData = {
    accessToken: string;
    refreshToken: string;
    expires: number;
};

export type TInternalUserSettings = {
    language: string;
    hide_leaderboard: boolean;
    bgm_enabled: boolean;
    bgm_volume: number;
    sfx_enabled: boolean;
    sfx_volume: number;
    daily_notifications: ('en-US' | 'de')[];
};

export type TUserSettings = {
    settings: TInternalUserSettings
};

export type TCommandHandler = (ctx: Context, additional?: Record<string, any>) => Promise<any>;

export type Command = {
    data: Partial<APIApplicationCommand>;
    execute?: TCommandHandler;
    autocomplete?: (ctx: Context, additional?: Record<string, any>) => Promise<any>;
};

export type Button = {
    custom_id: string;
    execute?: TCommandHandler;
};