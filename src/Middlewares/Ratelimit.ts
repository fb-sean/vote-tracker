import type {Middleware, TIncomingMessage, TMiddlewareNext, TServerResponse} from "@Types/HttpClient";
import {getHeaders, getIP, Response, setHeaders} from "@Utils/Http";
import Memory from "@API/MemoryCache";

const rateLimitConfig = {}

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

        next(true);
    }
}