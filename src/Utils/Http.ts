import type {TIncomingMessage, TServerResponse} from "@Types/HttpClient";
import Redis from "@API/RedisCache";

export function normalize(url?: string | null) {
    if (!url) return null;

    try {
        const u = new URL(url);

        return `${u.protocol}//${u.host}`;
    } catch {
        return null;
    }
}

export function Response(res: TServerResponse, data: string | object | any[] | null, status: number = 200): void {
    res.statusCode = status;

    if (data) {
        if (typeof data === 'object') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
        } else {
            res.setHeader('Content-Type', 'text/plain');
            res.end(data);
        }
    } else {
        res.end();
    }
}

export function Redirect(res: TServerResponse, url: string, statusCode: 307 | 308 | 301 = 307): void {
    res.statusCode = statusCode;
    res.setHeader('Location', url);
    res.end();
}

export function ImageResponse(res: TServerResponse, buffer: Buffer, statusCode: number = 200): void {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'image/jpeg');
    res.end(buffer);
}

export function getQuery(req: TIncomingMessage): Record<string, string | number> {
    const url = new URL(req.url || '', `https://${req.headers.host}`);
    const query: Record<string, string | number> = {};
    const params = url.searchParams;

    for (const key of params.keys()) {
        const value = params.get(key);
        if (value !== null) {
            query[key] = isNaN(Number(value)) ? value : Number(value);
        }
    }

    return query;
}

export function getParams(req: TIncomingMessage, context: { path: string }): Record<string, string> {
    if (req.params) {
        return req.params;
    }

    const routeParts = context.path.split('/');
    const urlParts = (req.url || '').split('?')[0].split('/');

    const params: Record<string, string> = {};

    for (let i = 0; i < routeParts.length; i++) {
        const part = routeParts[i];

        if (part.startsWith(':')) {
            const paramName = part.slice(1);
            params[paramName] = urlParts[i] || '';
        }
    }

    return params;
}

export function setCookies(res: TServerResponse, cookies: Record<string, string>): void {
    const cookieStrings = Object.entries(cookies).map(
        ([key, value]) => `${key}=${value}; Path=/; HttpOnly`
    );

    res.setHeader('Set-Cookie', cookieStrings);
}

export function getCookies(req: TIncomingMessage): Record<string, string> {
    const cookies: Record<string, string> = {};
    const cookieHeader = req.headers.cookie;

    if (cookieHeader) {
        const cookiePairs = cookieHeader.split(';');

        for (const pair of cookiePairs) {
            const [key, value] = pair.split('=').map(part => part.trim());
            cookies[key] = value;
        }
    }

    return cookies;
}

export async function setSession(req: TIncomingMessage, res: TServerResponse, data: Record<string, any>): Promise<void> {
    const cookies = getCookies(req);
    let sessionId = cookies.session;

    if (!sessionId) {
        sessionId = 'HANGMAN-DISCORD-ACTIVITY-SESSION-' + Math.random().toString(36).substr(2, 9);
        setCookies(res, {session: sessionId});
    }

    await Redis.getInstance().set<Record<string, any>>('discord:vt:session-' + sessionId, {
        ...data,
        createdAt: new Date()
    });
}

export async function deleteSession(req: TIncomingMessage, res: TServerResponse): Promise<void> {
    const cookies = getCookies(req);
    const sessionId = cookies.session;

    if (sessionId) {
        await Redis.getInstance().delete('discord:vt:session-' + sessionId);
        setCookies(res, {session: ''});
    }
}

export async function getSession(req: TIncomingMessage): Promise<Record<string, any> | undefined> {
    const cookies = getCookies(req);

    if (cookies.session) {
        const session = await Redis.getInstance().get<Record<string, any> | undefined>('discord:vt:session-' + cookies.session);

        if (session && session.createdAt && (new Date(session.createdAt)).getTime() + 1000 * 60 * 60 * 24 * 7 > Date.now()) {
            return session;
        }
    }

    return undefined;
}

export function setHeaders(res: TServerResponse, headers: Record<string, string>): void {
    for (const [key, value] of Object.entries(headers)) {
        res.setHeader(key, value);
    }
}

export function getHeaders(req: TIncomingMessage): Record<string, string> {
    const headers: Record<string, string> = {};

    for (const [key, value] of Object.entries(req.headers)) {
        headers[key] = value as string;
    }

    return headers;
}


export function getIP(req: TIncomingMessage): string {
    const raw = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    return (Array.isArray(raw) ? raw[0] : raw).split(',')[0].trim();
}