import type {TIncomingMessage, TRoute, TServerResponse} from "@Types/HttpClient";
import {Redirect, Response} from "@Utils/Http";

export default class HomeRoute implements TRoute {
    method = 'GET';
    path = '/';

    async execute(req: TIncomingMessage, res: TServerResponse) {
        return Redirect(res, 'https://top.gg/bot/813913649633951764?ref=website');
    }
}