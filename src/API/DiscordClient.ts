import {REST} from '@discordjs/rest';
import {Button, Command} from "@Types/Discord";
import {IContextPayloadExtended} from "@Types/Context";
import Redis from "@API/RedisCache";
import {APIChannel, Routes} from "discord-api-types/v10";

export class DiscordClient {
    private static _instance: DiscordClient;
    private readonly _rest: REST;
    private _commands: Map<string, Command> = new Map();
    private _buttons: Map<string, Button> = new Map();

    constructor() {
        this._rest = new REST({
            version: '10',
            timeout: 5000,
            api: 'http://0.0.0.0:9982/api'
        }).setToken(process.env.DISCORD_CLIENT_TOKEN);
    }

    public get rest(): REST {
        return this._rest;
    }

    public static getInstance(): DiscordClient {
        if (!DiscordClient._instance) {
            DiscordClient._instance = new DiscordClient();
        }

        return DiscordClient._instance;
    }

    public addCommand(command: Command) {
        this._commands.set(command.data.name!, command);
    }

    public getCommand(name: string) {
        return this._commands.get(name);
    }

    public addButton(button: Button) {
        this._buttons.set(button.custom_id, button);
    }

    public getButton(name: string) {
        return this._buttons.get(name);
    }

    public async sendDirectMessage(userId: string, payload: IContextPayloadExtended) {
        let channelId = await Redis.getInstance().get<string>('discord:vt:user:dm:' + userId);
        if (!channelId) {
            const channel = await this.rest.post(
                Routes.userChannels(),
                {
                    body: {
                        recipient_id: userId
                    },
                }
            ) as APIChannel;

            if (!channel.id) {
                return null;
            }

            channelId = channel.id;
            await Redis.getInstance().set('discord:vt:user:dm:' + userId, channelId, 60 * 2);
        }

        const files = payload.files ? payload.files : [];
        if (payload.files) delete payload.files;

        return this.rest.post(
            Routes.channelMessages(channelId),
            {
                body: payload,
                files: files,
            }
        );
    }
}