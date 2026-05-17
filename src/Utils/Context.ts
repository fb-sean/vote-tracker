import {
    APIApplicationCommandAutocompleteInteraction,
    APIApplicationCommandInteraction,
    APIApplicationCommandOptionChoice,
    APIChatInputApplicationCommandInteractionData,
    APIGuildMember,
    APIInteraction,
    APIMessageComponentInteraction,
    APIModalInteractionResponseCallbackData,
    APIUser,
    InteractionResponseType,
    InteractionType,
    Locale,
    Routes,
} from "discord-api-types/v10";
import type {TServerResponse} from "@Types/HttpClient";
import {IContextPayload, IContextPayloadExtended} from "@Types/Context";
import {Response} from "@Utils/Http";
import {DiscordClient} from "@API/DiscordClient";
import Logger from "@Utils/Logger";

export class Context {
    private readonly _res: TServerResponse;
    private readonly _interaction: APIInteraction;

    constructor(interaction: APIInteraction, res: TServerResponse) {
        this._res = res;
        this._interaction = interaction;
    }

    private _deferred: boolean = false;

    get deferred() {
        return this._deferred;
    }

    get interaction() {
        return this._interaction;
    }

    get user(): APIUser {
        return this._interaction.member ? this._interaction.member.user : this._interaction.user!;
    }

    get member(): APIGuildMember | null {
        return this._interaction.member ? this._interaction.member : null;
    }

    get locale() {
        return this.isCommand() || this.isAutoComplete() || this.isModal() || this.isComponent() ? this.interaction.locale : Locale.EnglishGB;
    }

    get isInGuild() {
        return this.interaction.guild_id !== null;
    }

    isModal(): this is { interaction: APIMessageComponentInteraction } {
        return this._interaction.type === InteractionType.ModalSubmit;
    }

    isComponent(): this is { interaction: APIMessageComponentInteraction } {
        return this._interaction.type === InteractionType.MessageComponent;
    }

    isAutoComplete(): this is { interaction: APIApplicationCommandAutocompleteInteraction } {
        return this._interaction.type === InteractionType.ApplicationCommandAutocomplete;
    }

    isCommand(): this is { interaction: APIApplicationCommandInteraction } {
        return this._interaction.type === InteractionType.ApplicationCommand;
    }

    _buildResponse(payload: IContextPayload) {
        return payload;
    }

    ack() {
        Logger.debug(`Interaction ${this.interaction.id} acknowledged`, 'INTERACTIONS');

        return Response(this._res, null, 202);
    }

    async reply(payload: IContextPayloadExtended) {
        Logger.debug(`Replying to interaction ${this.interaction.id}`, 'INTERACTIONS');

        const files = payload.files ? payload.files : [];
        if (payload.files) delete payload.files;

        return DiscordClient.getInstance().rest.post(Routes.interactionCallback(this.interaction.id, this.interaction.token), {
            body: {
                type: InteractionResponseType.ChannelMessageWithSource,
                data: this._buildResponse(payload),
            },
            files: files,
            auth: false
        });
    }

    async launchActivity() {
        Logger.debug(`Launching activity for interaction ${this.interaction.id}`, 'INTERACTIONS');

        return DiscordClient.getInstance().rest.post(Routes.interactionCallback(this.interaction.id, this.interaction.token), {
            body: {
                type: InteractionResponseType.LaunchActivity,
            },
            auth: false
        });
    }

    async deferUpdate() {
        Logger.debug(`Deferring update for interaction ${this.interaction.id}`, 'INTERACTIONS');

        this._deferred = true;

        return DiscordClient.getInstance().rest.post(Routes.interactionCallback(this.interaction.id, this.interaction.token), {
            body: {
                type: InteractionResponseType.DeferredMessageUpdate,
            },
            auth: false
        });
    }

    async deferReply(payload: IContextPayload = {}) {
        Logger.debug(`Deferring reply for interaction ${this.interaction.id}`, 'INTERACTIONS');

        this._deferred = true;

        return DiscordClient.getInstance().rest.post(Routes.interactionCallback(this.interaction.id, this.interaction.token), {
            body: {
                type: InteractionResponseType.DeferredChannelMessageWithSource,
                data: {
                    flags: payload.flags ? payload.flags : 0
                }
            },
            auth: false
        });
    }

    async update(payload: IContextPayloadExtended) {
        Logger.debug(`Updating interaction ${this.interaction.id}`, 'INTERACTIONS');

        const files = payload.files ? payload.files : [];
        if (payload.files) delete payload.files;

        return DiscordClient.getInstance().rest.post(Routes.interactionCallback(this.interaction.id, this.interaction.token), {
            body: {
                type: InteractionResponseType.UpdateMessage,
                data: this._buildResponse(payload)
            },
            files: files,
            auth: false
        });
    }

    async autocomplete(choices: APIApplicationCommandOptionChoice[]) {
        Logger.debug(`Autocompleting interaction ${this.interaction.id}`, 'INTERACTIONS');

        return DiscordClient.getInstance().rest.post(Routes.interactionCallback(this.interaction.id, this.interaction.token), {
            body: {
                type: InteractionResponseType.ApplicationCommandAutocompleteResult,
                data: {
                    choices,
                }
            },
            auth: false
        });
    }

    async showModal(modal: APIModalInteractionResponseCallbackData) {
        Logger.debug(`Showing modal for interaction ${this.interaction.id}`, 'INTERACTIONS');

        return DiscordClient.getInstance().rest.post(Routes.interactionCallback(this.interaction.id, this.interaction.token), {
            body: {
                type: InteractionResponseType.Modal,
                data: modal
            },
            auth: false
        });
    }

    async followUp(payload: IContextPayloadExtended) {
        Logger.debug(`Following up interaction ${this.interaction.id}`, 'INTERACTIONS');

        const files = payload.files ? payload.files : [];

        if (payload.files) delete payload.files;

        return DiscordClient.getInstance().rest.post(Routes.webhook(this.interaction.application_id, this.interaction.token), {
            body: this._buildResponse(payload),
            files: files,
            query: new URLSearchParams([['wait', 'true']]),
            auth: false
        });
    }

    async editReply(payload: IContextPayloadExtended) {
        Logger.debug(`Editing reply for interaction ${this.interaction.id}`, 'INTERACTIONS');

        const files = payload.files ? payload.files : [];

        if (payload.files) delete payload.files;

        return DiscordClient.getInstance().rest.patch(Routes.webhookMessage(this.interaction.application_id, this.interaction.token, this.interaction.message ? this.interaction.message.id : '@original'), {
            body: this._buildResponse(payload),
            files: files,
            query: new URLSearchParams([['wait', 'true']]),
            auth: false
        });
    }

    getOptionValue<T extends string>(name: string): Nullable<T> {
        let value = null;

        const data = this.interaction.data as APIChatInputApplicationCommandInteractionData;

        if (!data || !data.options) {
            return null;
        }

        for (const option of data.options) {
            // @ts-ignore
            if (option.options) {
                //  @ts-ignore
                for (const subOption of option.options) {
                    if (subOption.name === name) {
                        value = subOption.value;
                    }
                }
            } else {
                if (option.name === name) {
                    //  @ts-ignore
                    value = option.value;
                }
            }
        }

        return value;
    }
}