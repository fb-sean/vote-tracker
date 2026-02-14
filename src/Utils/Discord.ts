import {APIInteraction, RESTGetAPIUserResult, RESTPostOAuth2AccessTokenResult, Routes} from "discord-api-types/v10";
import {URLSearchParams} from "url";
import {isErrorResponse, TErrorResponse} from "@Types/Discord";
import Logger from "@Utils/Logger";
import Redis from "@API/RedisCache";
import {DiscordClient} from "@API/DiscordClient";
import UserDataModel from "@Schemas/UserData";

export function buildAvatarUrl(userId: string, avatar: Nullable<string>): string {
    if (!avatar) { // @ts-ignore
        return `https://cdn.discordapp.com/embed/avatars/${userId % 5}.png`;
    }

    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${avatar.includes('a_') ? 'webp?animated=true' : 'webp'}`;
}

export function isSnowflake(input: string): boolean {
    return /^\d{17,19}$/.test(input);
}

export function escapeMarkDown(text: string) {
    return text.replace(/[*_~|`]/g, '\$&');
}

export async function fetchAndSaveUserData(userId: string): Promise<Nullable<{
    userId: string;
    username: string;
    avatar: string | null
}>> {
    try {
        const cacheKey = `discord:vt:user:${userId}`;
        const cached = await Redis.getInstance().get<{
            userId: string;
            username: string;
            avatar: string | null
        }>(cacheKey);

        if (cached) {
            return cached;
        }

        const user = await DiscordClient.getInstance().rest.get(Routes.user(userId)) as {
            id: string;
            username: string;
            global_name: string | null;
            avatar: string | null
        };

        const mappedUser = {
            userId: user.id,
            username: user.global_name || user.username,
            avatar: user.avatar,
        };

        await UserDataModel.findOneAndUpdate(
            {userId: userId},
            mappedUser,
            {upsert: true}
        );

        await Redis.getInstance().set(cacheKey, mappedUser, 900);

        return mappedUser;
    } catch (error) {
        Logger.error(`Failed to fetch user ${userId}: ${error}`, 'Discord');

        return null;
    }
}

export async function fetchNewAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expires: number;
} | null> {
    if (!refreshToken) {
        return null;
    }

    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    });

    const response = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    }).catch(() => null);

    if (!response) {
        return null;
    }

    const data = await response.json() as RESTPostOAuth2AccessTokenResult | TErrorResponse;
    if (!data || isErrorResponse(data)) {
        return null;
    }

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expires: Date.now() + (data.expires_in * 1000),
    };
}

export async function fetchUser(tokenType: string, accessToken: string): Promise<{
    id: string;
    username: string;
    avatar: string | null;
} | null> {
    const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
            Authorization: `${tokenType} ${accessToken}`
        }
    }).catch(() => null);

    if (!userResponse) {
        return null;
    }

    const user = await userResponse.json() as RESTGetAPIUserResult;
    if (!user || !user.id) {
        return null;
    }

    return {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
    };
}

export async function fetchUserAfterLogin(code: string, isActivity = false): Promise<string | {
    id: string;
    username: string;
    avatar: string | null;
    locale: string;
    accessToken: string;
    refreshToken: string;
    expires: number;
}> {
    if (!code) {
        return 'discord.response.invalid_code';
    }

    Logger.debug('Fetching user data from Discord.', 'DISCORD');

    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        scope: 'identify rpc.activities.write guilds.members.read guilds applications.commands',
    });

    if (!isActivity) {
        params.append('redirect_uri', process.env.DISCORD_AUTH_CALLBACK_URL);
    }

    const response = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    }).catch(() => null);

    if (!response) {
        return 'discord.response.invalid';
    }

    const data = await response.json() as RESTPostOAuth2AccessTokenResult | TErrorResponse;
    if (!data) {
        return 'discord.response.invalid_data';
    }

    if (isErrorResponse(data)) {
        return 'discord.response.invalid_code';
    }

    const neededScopes = ['identify', 'rpc.activities.write', 'guilds.members.read', 'guilds', 'applications.commands'];
    if (neededScopes.some(scope => !data.scope.includes(scope))) {
        return 'discord.response.invalid_scope';
    }

    const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
            Authorization: `${data.token_type} ${data.access_token}`
        }
    }).catch(() => null);

    if (!userResponse) {
        return 'discord.response.invalid_user_fetch';
    }

    const user = await userResponse.json() as RESTGetAPIUserResult;
    if (!user || !user.id) {
        return 'discord.response.invalid_user_data';
    }

    return {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        locale: user.locale || 'en-US',
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expires: Date.now() + (data.expires_in * 1000),
    }
}

type _InteractionData = Partial<APIInteraction & {
    message_id?: string
}>;

export function hasPermissions(permissions: string, neededPermissions: bigint[]): boolean {
    const userPermissions = BigInt(permissions);

    return neededPermissions.every(permission => (userPermissions & permission) === permission);
}