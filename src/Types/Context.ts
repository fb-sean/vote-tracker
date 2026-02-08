import {APIBaseMessageNoChannel} from "discord-api-types/v10";

export interface IContextPayload extends Partial<APIBaseMessageNoChannel> {
}

export type IContextPayloadFile = { name: string, data: Buffer };

export interface IContextPayloadExtended extends IContextPayload {
    files?: IContextPayloadFile[];
}

export interface IContextChoice {
    name: string;
    value: string;
}