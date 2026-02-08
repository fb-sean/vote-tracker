import {Context} from "@Utils/Context";
import {Command} from "@Types/Discord";
import {
    ApplicationIntegrationType,
    ButtonStyle,
    ComponentType,
    InteractionContextType,
    MessageFlags
} from "discord-api-types/v10";

export default class HelpCommand implements Command {
    data = {
        name: 'help',
        description: 'Understand how to use Vote Tracker',
        integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
    };

    async execute(ctx: Context) {
        return ctx.reply({
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: '-# discord.gg/ZVERh35'
                },
                {
                    type: ComponentType.TextDisplay,
                    content: '### Vote tracking made easy!'
                },
                {
                    type: ComponentType.TextDisplay,
                    content: ''
                },
            ],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications,
        });
    }
}