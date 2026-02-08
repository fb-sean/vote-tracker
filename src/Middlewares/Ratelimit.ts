import type {Middleware, TIncomingMessage, TMiddlewareNext, TServerResponse} from "@Types/HttpClient";
import {getHeaders, getIP, Response, setHeaders} from "@Utils/Http";
import Memory from "@API/MemoryCache";
import Redis from "@API/RedisCache";
import type {UserData} from "@Schemas/UserData";
import type {TDiscordUserAuthData, TUserSettings} from "@Types/Discord";
import {toSettings} from "@Utils/Settings";

const rateLimitConfig = {}

const authOnlyRoutes = [
    '/game/start',
    '/game/guess',
    '/game/hint',
    '/game/other-players',
    '/discord/refetch-avatar',
    '/discord/current-user',
    '/user/settings',
    '/leaderboard'
];

export default class RateLimitMiddleware implements Middleware {
    global = true;

    async execute(req: TIncomingMessage, res: TServerResponse, next: TMiddlewareNext) {
        const headers = getHeaders(req);
        const method = req.method?.toUpperCase() || '';

        const config = rateLimitConfig[req.path!];
        const now = Date.now();

        const checkRateLimit = async (key: string, max: number, per: number) => {
            if (!key) return true;

            const entry = await Memory.getInstance().get<{
                count: number;
                startTime: number;
            }>(key);

            if (!entry) {
                await Memory.getInstance().set(key, {count: 1, startTime: now}, per / 1000);
                return true;
            }

            if (now - entry.startTime < per) {
                if (entry.count >= max) {
                    return false;
                }
                await Memory.getInstance().set(key, {count: entry.count + 1, startTime: entry.startTime}, per / 1000);
            } else {
                await Memory.getInstance().set(key, {count: 1, startTime: now}, per / 1000);
            }

            return true;
        };

        const ip = getIP(req);
        if (config) {
            const ipConfig = config.ip || {max: 5, per: 1000};

            if (!await checkRateLimit('hda:rl:ips:' + ip + config.path, ipConfig.max, ipConfig.per)) {
                setHeaders(
                    res,
                    {
                        'Retry-After': String(ipConfig.per / 1000),
                        'X-RateLimit-Limit': String(ipConfig.max),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': String(ipConfig.per / 1000),
                    }
                );

                Response(res, {
                    error: 'Rate limit exceeded',
                    message: 'You have exceeded the rate limit for this endpoint.',
                }, 429);

                return next(false);
            }
        }

        const globalConfig = {max: 10, per: 1000};
        if (!await checkRateLimit('hda:rl:ips:global:' + ip, globalConfig.max, globalConfig.per)) {
            setHeaders(
                res,
                {
                    'Retry-After': String(globalConfig.per / 1000),
                    'X-RateLimit-Limit': String(globalConfig.max),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(globalConfig.per / 1000),
                }
            );

            Response(res, {
                error: 'Rate limit exceeded',
                message: 'You have exceeded the global rate limit.',
            }, 429);

            return next(false);
        }

        const token = headers.authorization ? headers.authorization.replace('Bearer ', '').trim() : null;
        if (token) {
            req.user = await Redis.getInstance().get<(UserData & TDiscordUserAuthData & TUserSettings)>('hda:user:' + token);

            if (req.user && (!req.user?.settings?.language || !req.user?.settings?.hide_leaderboard || !req.user?.settings?.bgm_volume || !req.user?.settings?.sfx_volume)) {
                req.user!.settings = toSettings(req.user?.settings);
            }
        }

        if (authOnlyRoutes.some(route => req.path?.startsWith(route)) && !req.user && method !== 'OPTIONS') {
            Response(res, {
                error: 'Unauthorized',
                message: 'You are not authorized to access this endpoint.',
            }, 403);

            return next(false);
        }

        next(true);
    }
}