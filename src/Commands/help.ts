import {Context} from "@Utils/Context";
import {Command} from "@Types/Discord";
import {ApplicationIntegrationType, ButtonStyle, ComponentType, InteractionContextType, MessageFlags} from "discord-api-types/v10";

export default class HelpCommand implements Command {
    data = {
        name: 'help',
        description: 'Understand how to use Vote Tracker',
        integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
    };

    async execute(ctx: Context) {
        const components: any[] = [
            {
                type: ComponentType.TextDisplay,
                content: '# Vote Tracker',
            },
            {
                type: ComponentType.TextDisplay,
                content: 'Track votes for your Discord bot or server with powerful notifications and role rewards.',
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.TextDisplay,
                content: '## Features',
            },
            {
                type: ComponentType.TextDisplay,
                content: '- 📢 **Vote Notifications** - Get notified in a channel or via webhook\n- 🎁 **Role Rewards** - Auto-assign roles when users vote\n- ⚙️ **Custom Messages** - Fully customizable vote messages\n- 🔗 **Multiple Platforms** - Works with top.gg, discord.ly, and more',
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.TextDisplay,
                content: '## Getting Started',
            },
            {
                type: ComponentType.TextDisplay,
                content: 'Use `/setup` to create your first vote tracking setup, or `/list` to view and edit existing configurations.',
            },
        ];

        if (ctx.isInGuild) {
            components.push({
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Primary,
                        label: 'Setup Vote Tracking',
                        custom_id: 'help_setup',
                    },
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Secondary,
                        label: 'List Setups',
                        custom_id: 'help_list',
                    },
                ],
            });
        }

        components.push({
            type: ComponentType.Separator,
            spacing: 1,
        });

        components.push({
            type: ComponentType.TextDisplay,
            content: 'Need help? Join our support server: <discord.gg/ZVERh35>',
        });

        return ctx.reply({
            components,
            flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications,
        });
    }
}