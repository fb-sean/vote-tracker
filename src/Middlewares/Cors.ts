import type {Middleware, TIncomingMessage, TMiddlewareNext, TServerResponse} from "@Types/HttpClient";
import {normalize} from "@Utils/Http";

const allowedOrigins = [
    'https://api-hangman.discord.dad',
    'https://hangman.discord.dad',
    'http://localhost:4401',
    'http://localhost:4402',
    'https://hangman.discord.dad',
    'https://1431408673724432596.discordsays.com',
];

const devOrigins = [
    'http://localhost:4401',
    'http://localhost:4402',
];

export default class CorsMiddleware implements Middleware {
    global = true;

    async execute(req: TIncomingMessage, res: TServerResponse, next: TMiddlewareNext) {
        const origin = normalize(req.headers.origin);
        const referer = normalize(req.headers.referer);

        res.setHeader('Vary', 'Origin');

        if ((origin && allowedOrigins.includes(origin)) || (referer && allowedOrigins.includes(referer))) {
            if ((origin && devOrigins.includes(origin)) || (referer && devOrigins.includes(referer))) {
                req.isDev = true;
            }

            res.setHeader('Access-Control-Allow-Origin', String(origin ?? referer));
        } else {
            res.setHeader('Access-Control-Allow-Origin', '*');
        }

        req.frontEndUrl = req.isDev ? 'http://localhost:4402' : 'https://hangman.discord.dad';

        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

        res.setHeader('Access-Control-Max-Age', '2');

        next(true);
    }
}