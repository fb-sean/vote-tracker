import type {Middleware, TIncomingMessage, TMiddlewareNext, TServerResponse} from "@Types/HttpClient";
import {normalize} from "@Utils/Http";

const allowedOrigins = [
    'https://discordbotlist.com',
    'http://localhost:4401',
    'http://localhost:4402'
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
            res.setHeader('Access-Control-Allow-Origin', String(origin ?? referer));
        } else {
            res.setHeader('Access-Control-Allow-Origin', '*');
        }

        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, x-dbl-signature, X-Requested-With, Content-Type, Accept, Authorization');

        res.setHeader('Access-Control-Max-Age', '2');

        next(true);
    }
}