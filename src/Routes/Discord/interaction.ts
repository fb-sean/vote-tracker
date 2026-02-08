import type {TIncomingMessage, TRoute, TServerResponse} from "@Types/HttpClient";
import {Context} from "@Utils/Context";
import {APIInteraction, ComponentType, MessageFlags} from "discord-api-types/v10";
import {DiscordClient} from "@API/DiscordClient";
import Logger from "@Utils/Logger";
import Redis from "@API/RedisCache";
import {canOpenActivity, registerUserInChannel, updateGameStateMessage} from "@Utils/Discord";

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
            const button = DiscordClient.getInstance().getButton(ctx.interaction.data.custom_id.split('_')[0]);
            if (!button) {
                return ctx.reply({
                    content: 'global.invalidComponent',
                });
            }

            return ctx.reply({
                content: 'global.invalidComponent',
            });
        }
    }
}