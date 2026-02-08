import type {TIncomingMessage, TRoute, TServerResponse} from "@Types/HttpClient";
import {Context} from "@Utils/Context";
import {APIInteraction, ComponentType, MessageFlags, InteractionType} from "discord-api-types/v10";
import {DiscordClient} from "@API/DiscordClient";
import Logger from "@Utils/Logger";
import {
    handleSetupBot,
    handleSetupServer,
    handleSetupCancel,
    handleSetupBack,
    handleSetupNext,
    handleSetupEnterEntityId,
    handleSetupChannelSelect,
    handleSetupEnterWebhook,
    handleSetupTestChannel,
    handleSetupEditFirstVote,
    handleSetupEditVote,
    handleSetupAddReward,
    handleSetupRemoveReward,
    handleSetupFinish,
    handleSetupEntityIdModal,
    handleSetupWebhookModal,
    handleSetupFirstVoteModal,
    handleSetupVoteModal,
    handleSetupAddRewardModal,
} from "@Handlers/SetupHandlers";

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
                        return handleSetupRemoveReward(ctx, setupId);
                    }
                    break;
                case 'finish':
                    return handleSetupFinish(ctx, setupId);
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
            const component = components.find((c: any) => c.components?.[0]?.custom_id === customId);
            return component?.components?.[0]?.value || '';
        };

        const getSelectValue = (customId: string): string => {
            const component = components.find((c: any) => c.components?.[0]?.custom_id === customId);
            const values = component?.components?.[0]?.values;
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
}
