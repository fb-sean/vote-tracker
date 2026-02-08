import {
    APIInteraction,
    APIMessage,
    ButtonStyle,
    ComponentType, MessageFlags,
    PermissionFlagsBits,
    RESTGetAPIUserResult,
    RESTPostOAuth2AccessTokenResult,
    Routes
} from "discord-api-types/v10";
import {URLSearchParams} from "url";
import {isErrorResponse, TErrorResponse} from "@Types/Discord";
import Logger from "@Utils/Logger";
import GameSessionModel from "@Schemas/GameSession";
import {DiscordClient} from "@API/DiscordClient";
import {buildSVG, renderImage} from "@Utils/SVG";
import Redis from "@API/RedisCache";
import UserDataModel from "@Schemas/UserData";
import type {GameSessionWithUser} from "@Types/Game";
import RedisQueue from "@API/RedisQueue";
import {EWorkerJobs} from "@Types/RedisQueue";
import {Context} from "@Utils/Context";

export function buildAvatarUrl(userId: string, avatar: Nullable<string>): string {
    if (!avatar) { // @ts-ignore
        return `https://cdn.discordapp.com/embed/avatars/${userId % 5}.png`;
    }

    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${avatar.includes('a_') ? 'gif' : 'webp'}?size=1024`;
}

export function isSnowflake(input: string): boolean {
    return /^\d{17,19}$/.test(input);
}

export function escapeMarkDown(text: string) {
    return text.replace(/[*_~|`]/g, '\$&');
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

export async function getChannelByUser(userId: string): Promise<string | null> {
    return Redis.getInstance().get<string>(`hda:user:channel:${userId}`);
}

export async function getChannelUsers(channelId: string): Promise<string[]> {
    return Redis.getInstance().getClient().smembers(`hda:channel:users:${channelId}`);
}

export async function getPrimaryInteraction(channelId: string): Promise<_InteractionData | null> {
    return Redis.getInstance().get<_InteractionData>(`hda:channel:interaction:primary:${channelId}`);
}

async function getFallbackInteraction(channelId: string): Promise<_InteractionData | null> {
    return Redis.getInstance().get<_InteractionData>(`hda:channel:interaction:fallback:${channelId}`);
}

export async function setPrimaryInteraction(channelId: string, interaction: _InteractionData, ttlSeconds = 60 * 20) {
    await Redis.getInstance().set(
        `hda:channel:interaction:primary:${channelId}`,
        interaction,
        ttlSeconds,
    );
}

async function clearChannelInteractions(channelId: string) {
    await Redis.getInstance().getClient().del(
        `hda:channel:interaction:primary:${channelId}`,
        `hda:channel:interaction:fallback:${channelId}`,
        `hda:channel:users:${channelId}`,
    );
}

export async function registerUserInChannel(
    userId: string,
    interaction: _InteractionData,
    ttlSeconds = 60 * 20
) {
    const channelUsersKey = `hda:channel:users:${interaction.channel!.id!}`;
    const primaryKey = `hda:channel:interaction:primary:${interaction.channel!.id!}`;

    const interactionData = JSON.stringify({
        id: interaction.id,
        application_id: interaction.application_id,
        token: interaction.token,
        message_id: interaction.message_id,
    });

    const multi = Redis.getInstance().getClient().multi();

    multi.set(`hda:user:channel:${userId}`, interaction.channel!.id!, 'EX', ttlSeconds);

    multi.sadd(channelUsersKey, userId);
    multi.expire(channelUsersKey, ttlSeconds);

    multi.set(`hda:channel:interaction:fallback:${interaction.channel!.id!}`, interactionData, 'EX', ttlSeconds);

    multi.set(primaryKey, interactionData, 'EX', ttlSeconds, 'NX');
    multi.expire(primaryKey, ttlSeconds);

    multi.expire(primaryKey, ttlSeconds);

    await multi.exec();
}

export async function unregisterUser(userId: string): Promise<void> {
    const userChannelKey = `hda:user:channel:${userId}`;
    const channelId = await Redis.getInstance().get<string>(userChannelKey);

    if (!channelId) {
        return;
    }

    const channelUsersKey = `hda:channel:users:${channelId}`;

    const multi = Redis.getInstance().getClient().multi();

    multi.del(userChannelKey);

    multi.srem(channelUsersKey, userId);

    await multi.exec();

    const remainingUsers = await Redis.getInstance().getClient().scard(channelUsersKey);

    if (remainingUsers === 0) {
        await Redis.getInstance().getClient().del(channelUsersKey, `hda:channel:interaction:primary:${channelId}`, `hda:channel:interaction:fallback:${channelId}`);
    }
}

async function buildGameStatePayload(gameSessions: GameSessionWithUser[]) {
    const galleryItems: {
        media: {
            url: string,
        },
        description: string,
    }[] = [];
    const files: { name: string; data: Buffer }[] = [];
    const removedUsers: string[] = [];

    for (const {gameSession, userData} of gameSessions) {
        let lastTimePlayed = await Redis.getInstance().get<string | number>(`hda:user:last-gameinteraction:${gameSession.user_id}`);
        if (!lastTimePlayed) {
            await unregisterUser(gameSession.user_id);
            removedUsers.push(gameSession.user_id);

            continue;
        }

        if (typeof lastTimePlayed === 'string') {
            lastTimePlayed = parseInt(lastTimePlayed);
        }

        if ((Date.now() - lastTimePlayed) > 120_000) {
            await unregisterUser(gameSession.user_id);
            removedUsers.push(gameSession.user_id);

            continue;
        }

        if (galleryItems.length >= 10) {
            break;
        }

        const triesLeft = gameSession ? gameSession.tries_left : 6;

        const avatarUrl =
            userData?.avatar && userData.avatar.startsWith('https://')
                ? userData.avatar
                : (userData?.avatar
                    ? buildAvatarUrl(gameSession.user_id, userData.avatar)
                    : undefined);

        const svgBuffer = await buildSVG(triesLeft, avatarUrl);
        const pngBuffer = await renderImage(svgBuffer);

        let description = `${userData.username} is playing today\'s hangman... ${triesLeft} tries left!`;

        if (gameSession.status === 'won') {
            description = `👑 ${userData.username} won today\'s hangman game! ${triesLeft} tries left.`;
        }

        if (gameSession.status === 'lost') {
            description = `💀 ${userData.username} lost today\'s hangman game.`;
        }

        const fileName = `hangman_${gameSession.user_id}.png`;

        galleryItems.push({
            media: {
                url: `attachment://${fileName}`,
            },
            description,
        });

        files.push({
            name: fileName,
            data: pngBuffer,
        });
    }

    gameSessions = gameSessions.filter(session => !removedUsers.includes(session.gameSession.user_id));

    if (galleryItems.length === 0) {
        Logger.info('No users to send game state message to.', 'DISCORD');

        return null;
    }

    let text = '';
    if (gameSessions.length === 1) {
        text = galleryItems[0].description;
    } else {
        if (gameSessions.length === 2) {
            text = `${escapeMarkDown(gameSessions[0].userData.username!)} and ${escapeMarkDown(gameSessions[1].userData.username!)} are playing today\'s hangman!`;
        } else {
            text = `${escapeMarkDown(gameSessions[0].userData.username!)} and ${gameSessions.length - 1} are playing today\'s hangman!`;
        }
    }

    const body = {
        components: [
            {
                type: ComponentType.TextDisplay,
                content: text,
            },
            {
                type: ComponentType.MediaGallery,
                items: galleryItems.slice(0, 10),
            },
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Primary,
                        label: 'Play now!',
                        custom_id: 'open',
                    },
                ],
            },
        ],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications,
    };

    return {
        body,
        files,
        query: new URLSearchParams([['wait', 'true']]),
        auth: false
    };
}

export async function _updateGameStateMessageInternal(channelId: string) {
    const userIds = await getChannelUsers(channelId);
    if (!userIds.length) {
        return;
    }

    const gameSessions = await GameSessionModel.aggregate([
        {
            $match: {
                user_id: {$in: userIds},
            },
        },
        {
            $sort: {
                updatedAt: -1,
            },
        },
        {
            $group: {
                _id: '$user_id',
                latestGameSession: {$first: '$$ROOT'},
            },
        },
        {
            $lookup: {
                from: UserDataModel.collection.name,
                localField: 'latestGameSession.user_id',
                foreignField: 'userId',
                as: 'userData',
            },
        },
        {
            $unwind: {
                path: '$userData',
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                _id: 0,
                gameSession: '$latestGameSession',
                userData: '$userData',
            },
        },
    ]) as GameSessionWithUser[];

    if (!gameSessions.length) {
        return;
    }

    const primary = await getPrimaryInteraction(channelId);
    if (!primary) {
        return;
    }

    const payload = await buildGameStatePayload(gameSessions);
    if (!payload) {
        return;
    }

    try {
        if (!primary.message_id) {
            const message = await DiscordClient.getInstance().rest.post(
                Routes.webhook(primary.application_id!, primary.token),
                payload,
            ) as APIMessage;

            await setPrimaryInteraction(channelId, {
                ...primary,
                message_id: message.id,
            });

        } else {
            await DiscordClient.getInstance().rest.patch(
                Routes.webhookMessage(primary.application_id!, primary.token!, primary.message_id),
                payload,
            );
        }

        return;
    } catch (error) {
        Logger.info('Failed to update primary game state message: ' + error, 'DISCORD');
    }

    const fallback = await getFallbackInteraction(channelId);
    if (!fallback) {
        await clearChannelInteractions(channelId);

        return;
    }

    try {
        const message = await DiscordClient.getInstance().rest.post(
            Routes.webhook(fallback.application_id!, fallback.token),
            payload,
        ) as APIMessage;

        await setPrimaryInteraction(channelId, {
            ...fallback,
            message_id: message.id,
        });
    } catch (error) {
        Logger.info('Failed to follow up with fallback interaction: ' + error, 'DISCORD');

        await clearChannelInteractions(channelId);
    }
}

export async function updateGameStateMessage(userId: string) {
    const channelId = await getChannelByUser(userId);
    if (!channelId) {
        return;
    }

    const pendingKey = `hda:channel:pending-update:${channelId}`;
    const isPending = await Redis.getInstance().get<boolean>(pendingKey);

    if (isPending) {
        await Redis.getInstance().set(pendingKey, true, 6);

        return;
    }

    await Redis.getInstance().set(pendingKey, true, 6);

    setTimeout(async () => {
        try {
            await RedisQueue.getInstance().addJob(EWorkerJobs.UpdateGameStateMessage, {
                channelId,
            });

            Logger.debug(`Queued game state update for channel ${channelId}`, 'DISCORD');
        } catch (error) {
            Logger.error(`Failed to queue game state update: ${error}`, 'DISCORD');

            await Redis.getInstance().delete(pendingKey);
        }
    }, 500);
}

export function canOpenActivity(ctx: Context): boolean {
    // not on a server => fine
    if (!ctx.interaction.member?.permissions) {
        return true;
    }

    if (Object.keys(ctx.interaction.authorizing_integration_owners).includes('0')) {
        return hasPermissions(
            ctx.interaction.member.permissions,
            [
                PermissionFlagsBits.UseEmbeddedActivities
            ]
        );
    }

    return hasPermissions(
        ctx.interaction.member.permissions,
        [
            PermissionFlagsBits.UseExternalApps,
            PermissionFlagsBits.UseEmbeddedActivities
        ]
    );
}

export function hasPermissions(permissions: string, neededPermissions: bigint[]): boolean {
    const userPermissions = BigInt(permissions);

    return neededPermissions.every(permission => (userPermissions & permission) === permission);
}