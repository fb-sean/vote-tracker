import type {TIncomingMessage, TRoute, TServerResponse} from "@Types/HttpClient";
import {Context} from "@Utils/Context";
import {APIInteraction, ComponentType, MessageFlags} from "discord-api-types/v10";
import {DiscordClient} from "@API/DiscordClient";
import Logger from "@Utils/Logger";
import {
    handleSetupAddReward,
    handleSetupAddRewardModal,
    handleSetupBack,
    handleSetupBot,
    handleSetupCancel,
    handleSetupChannelSelect,
    handleSetupEditFirstVote,
    handleSetupEditVote,
    handleSetupEnterEntityId,
    handleSetupEnterWebhook,
    handleSetupEntityIdModal,
    handleSetupFinish,
    handleSetupFirstVoteModal,
    handleSetupGame,
    handleSetupNext,
    handleSetupPlatformBack,
    handleSetupPlatformDiscordBotList,
    handleSetupPlatformDiscordsCom,
    handleSetupPlatformTopGG,
    handleSetupRemoveReward,
    handleSetupServer,
    handleSetupTestChannel,
    handleSetupUsePreFetchedId,
    handleSetupVoteModal,
    handleSetupWebhookModal,
} from "@Handlers/SetupHandlers";
import {handleListDelete, handleListDeleteCancel, handleListDeleteConfirm, handleListEdit, handleListDump, handleListToggleDisable, handleListToggleEnable,} from "@Handlers/ListHandlers";
import {createSetupState, getAllSetupsForServer, buildSetupList} from "@Utils/SetupManager";
import {buildEntitySelectionStep} from "@Utils/SetupComponents";

export default class InteractionRoute implements TRoute {
    method = 'POST';
    path = '/discord/interaction';

    async execute(req: TIncomingMessage, res: TServerResponse) {
        const ctx = new Context(req.body as APIInteraction, res);

        ctx.ack();

        if (ctx.isCommand()) {
            const command = DiscordClient.getInstance().getCommand(ctx.interaction.data.name);
            if (!command) {
                return ctx.reply({
                    content: 'global.invalidCommand',
                });
            }

            if (command.execute) {
                return command.execute(ctx)
                    .then(() => {
                        Logger.info(`Command ${command.constructor.name} executed by ${ctx.user.username} (${ctx.user.id})`, 'COMMANDS');
                    })
                    .catch(async (e) => {
                        Logger.error(`Error executing command ${command.constructor.name} by ${ctx.user.username} (${ctx.user.id})`, 'COMMANDS');
                        console.log(e);

                        if (ctx.deferred) {
                            return await ctx.editReply({
                                content: 'global.unknownError',
                            });
                        }

                        return ctx.reply({
                            content: 'global.unknownError',
                        });
                    });
            }

            return ctx.reply({
                content: 'global.invalidCommand',
            });
        }

        if (ctx.isComponent()) {
            const customId = ctx.interaction.data.custom_id;
            const parts = customId.split('_');

            if (parts[0] === 'setup') {
                return this.handleSetupComponent(ctx, parts);
            }

            if (parts[0] === 'list') {
                return this.handleListComponent(ctx, parts);
            }

            if (parts[0] === 'help') {
                return this.handleHelpComponent(ctx, parts);
            }

            const button = DiscordClient.getInstance().getButton(parts[0]);
            if (!button) {
                return ctx.reply({
                    content: 'global.invalidComponent',
                });
            }

            if (button.execute) {
                return button.execute(ctx)
                    .then(() => {
                        Logger.info(`Button ${button.custom_id} executed by ${ctx.user.username} (${ctx.user.id})`, 'BUTTONS');
                    })
                    .catch(async (e) => {
                        Logger.error(`Error executing button ${button.custom_id} by ${ctx.user.username} (${ctx.user.id})`, 'BUTTONS');
                        console.log(e);

                        if (ctx.deferred) {
                            return await ctx.editReply({
                                content: 'global.unknownError',
                            });
                        }

                        return ctx.reply({
                            content: 'global.unknownError',
                        });
                    });
            }

            return ctx.reply({
                content: 'global.invalidComponent',
            });
        }

        if (ctx.isAutoComplete()) {
            const command = DiscordClient.getInstance().getCommand(ctx.interaction.data.name);
            if (!command) {
                return ctx.autocomplete([]);
            }

            const additional: Record<string, any> = {};
            const data = ctx.interaction.data;

            if (data && data.options) {
                for (const option of data.options) {
                    // @ts-ignore - focused exists on autocomplete options
                    if (option.focused) {
                        continue;
                    }

                    // @ts-ignore
                    additional[option.name] = option.value;
                }
            }

            if (command.autocomplete) {
                return command.autocomplete(ctx, additional)
                    .catch(async (e) => {
                        Logger.error(`Error in autocomplete for ${command.constructor.name}`, 'AUTOCOMPLETE');
                        console.log(e);
                        return ctx.autocomplete([]);
                    });
            }

            return ctx.autocomplete([]);
        }

        if (ctx.isModal()) {
            const customId = ctx.interaction.data.custom_id;
            const parts = customId.split('_');

            if (parts[0] === 'setup' && parts[1] === 'modal') {
                return this.handleSetupModal(ctx, parts);
            }

            return ctx.reply({
                content: 'global.invalidModal',
            });
        }
    }

    async handleSetupComponent(ctx: Context, parts: string[]) {
        const action = parts[1];
        const setupId = parts[parts.length - 1];

        try {
            switch (action) {
                case 'bot':
                    return handleSetupBot(ctx, setupId);
                case 'server':
                    return handleSetupServer(ctx, setupId);
                case 'game':
                    return handleSetupGame(ctx, setupId);
                case 'cancel':
                    return handleSetupCancel(ctx, setupId);
                case 'back':
                    return handleSetupBack(ctx, setupId);
                case 'next':
                    return handleSetupNext(ctx, setupId);
                case 'enter':
                    if (parts[2] === 'entityid') {
                        return handleSetupEnterEntityId(ctx, setupId);
                    }

                    if (parts[2] === 'webhook') {
                        return handleSetupEnterWebhook(ctx, setupId);
                    }

                    break;
                case 'use':
                    if (parts[2] === 'prefetched' && parts[3] === 'id') {
                        return handleSetupUsePreFetchedId(ctx, setupId);
                    }

                    break;
                case 'select':
                    if (parts[2] === 'channel') {
                        return handleSetupChannelSelect(ctx, setupId);
                    }

                    break;
                case 'test':
                    if (parts[2] === 'channel') {
                        return handleSetupTestChannel(ctx, setupId);
                    }

                    break;
                case 'edit':
                    if (parts[2] === 'firstvote') {
                        return handleSetupEditFirstVote(ctx, setupId);
                    }

                    if (parts[2] === 'vote') {
                        return handleSetupEditVote(ctx, setupId);
                    }

                    break;
                case 'add':
                    if (parts[2] === 'reward') {
                        return handleSetupAddReward(ctx, setupId);
                    }

                    break;
                case 'remove':
                    if (parts[2] === 'reward') {
                        const rewardIndex = parts[4];

                        return handleSetupRemoveReward(ctx, setupId, rewardIndex);
                    }

                    break;
                case 'finish':
                    return handleSetupFinish(ctx, setupId);
                case 'platform':
                    if (parts[2] === 'topgg') {
                        return handleSetupPlatformTopGG(ctx, setupId);
                    }

                    if (parts[2] === 'discordbotlist') {
                        return handleSetupPlatformDiscordBotList(ctx, setupId);
                    }

                    if (parts[2] === 'discordscom') {
                        return handleSetupPlatformDiscordsCom(ctx, setupId);
                    }

                    if (parts[2] === 'back') {
                        return handleSetupPlatformBack(ctx, setupId);
                    }

                    break;
                default:
                    return ctx.reply({content: 'Unknown setup action.'});
            }
        } catch (error) {
            Logger.error(`Error handling setup component ${action}: ${error}`, 'SETUP');
            console.log(error);

            return ctx.reply({content: 'An error occurred while processing your request.'});
        }
    }

    async handleSetupModal(ctx: Context, parts: string[]) {
        const modalType = parts[2];
        const setupId = parts[parts.length - 1];

        if (!ctx.interaction.data) {
            return ctx.reply({content: 'Invalid modal data.'});
        }

        const components = (ctx.interaction.data as any).components || [];

        const getValue = (customId: string): string => {
            const component = components.find((c: any) => c.component?.custom_id === customId || c.components?.[0]?.custom_id === customId);

            return component?.component?.value || component?.components?.[0]?.value || '';
        };

        const getSelectValue = (customId: string): string => {
            const component = components.find((c: any) => c.component?.custom_id === customId || c.components?.[0]?.custom_id === customId);
            const values = component?.component?.values || component?.components?.[0]?.values;

            return values && values.length > 0 ? values[0] : '';
        };

        try {
            switch (modalType) {
                case 'entityid':
                    return handleSetupEntityIdModal(ctx, setupId, getValue('entity_id'));
                case 'webhook':
                    return handleSetupWebhookModal(ctx, setupId, getValue('webhook_url'));
                case 'firstvote':
                    return handleSetupFirstVoteModal(ctx, setupId, getValue('message'));
                case 'vote':
                    return handleSetupVoteModal(ctx, setupId, getValue('message'));
                case 'addreward':
                    return handleSetupAddRewardModal(ctx, setupId, getSelectValue('role_id'), getValue('min_votes'), getValue('duration_min'));
                default:
                    return ctx.reply({content: 'Unknown setup modal type.'});
            }
        } catch (error) {
            Logger.error(`Error handling setup modal ${modalType}: ${error}`, 'SETUP');
            console.log(error);

            return ctx.reply({content: 'An error occurred while processing your request.'});
        }
    }

    async handleListComponent(ctx: Context, parts: string[]) {
        const action = parts[1];

        try {
            switch (action) {
                case 'edit':
                    return handleListEdit(ctx, parts[2]);
                case 'dump':
                    return handleListDump(ctx, parts[2]);
                case 'delete':
                    // list_delete_{setupId} -> parts: ['list', 'delete', setupId]
                    // list_delete_confirm_{setupId} -> parts: ['list', 'delete', 'confirm', setupId]
                    // list_delete_cancel_{setupId} -> parts: ['list', 'delete', 'cancel', setupId]
                    if (parts[2] === 'confirm') {
                        return handleListDeleteConfirm(ctx, parts[3]);
                    }
                    if (parts[2] === 'cancel') {
                        return handleListDeleteCancel(ctx, parts[3]);
                    }
                    return handleListDelete(ctx, parts[2]);
                case 'toggle':
                    // list_toggle_enable_{setupId} -> parts: ['list', 'toggle', 'enable', setupId]
                    // list_toggle_disable_{setupId} -> parts: ['list', 'toggle', 'disable', setupId]
                    if (parts[2] === 'enable') {
                        return handleListToggleEnable(ctx, parts[3]);
                    }
                    if (parts[2] === 'disable') {
                        return handleListToggleDisable(ctx, parts[3]);
                    }
                    break;
                default:
                    return ctx.reply({content: 'Unknown list action.'});
            }
        } catch (error) {
            Logger.error(`Error handling list component ${action}: ${error}`, 'LIST');
            console.log(error);
            return ctx.reply({content: 'An error occurred while processing your request.'});
        }
    }

    async handleHelpComponent(ctx: Context, parts: string[]) {
        const action = parts[1];

        try {
            switch (action) {
                case 'setup':
                    if (!ctx.isInGuild) {
                        return ctx.reply({content: 'Setup can only be used in a server.'});
                    }
                    const setupId = await createSetupState(ctx.interaction.guild_id!, ctx.user.id);
                    return ctx.update({
                        ...buildEntitySelectionStep(setupId),
                        flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral,
                    });
                case 'list':
                    if (!ctx.isInGuild) {
                        return ctx.reply({content: 'List can only be used in a server.'});
                    }
                    const setups = await getAllSetupsForServer(ctx.interaction.guild_id!);
                    const listPayload = buildSetupList(setups, ctx.interaction.guild_id!);
                    return ctx.update({
                        ...listPayload,
                        flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral,
                    });
                default:
                    return ctx.reply({content: 'Unknown help action.'});
            }
        } catch (error) {
            Logger.error(`Error handling help component ${action}: ${error}`, 'HELP');
            console.log(error);
            return ctx.reply({content: 'An error occurred while processing your request.'});
        }
    }
}
