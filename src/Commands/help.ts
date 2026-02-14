import {Context} from "@Utils/Context";
import {Command} from "@Types/Discord";
import {
    APIComponentInContainer,
    ApplicationIntegrationType, ButtonStyle, ComponentType, InteractionContextType, MessageFlags
} from "discord-api-types/v10";
import {BrightImages} from "@Utils/BrightImages";

export default class HelpCommand implements Command {
    data = {
        name: 'help',
        description: 'Understand how to use Votes',
        integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
    };

    async execute(ctx: Context) {
        return ctx.reply({
            components: [
                {
                    type: ComponentType.Container,
                    accent_color: 6387427,
                    components: [
                        {
                            type: ComponentType.Section,
                            accessory: {
                                type: ComponentType.Thumbnail,
                                media: {
                                    url: BrightImages.Peace
                                }
                            },
                            components: [
                                {
                                    type: ComponentType.TextDisplay,
                                    content: '### Votes - Tracking and rewarding made easy'
                                },
                                {
                                    type: ComponentType.TextDisplay,
                                    content: 'Track votes for your Discord bot or server with powerful notifications and role rewards.',
                                },
                            ]
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
                            content: '- 📢 **Vote Notifications** - Get notified in a channel or send external webhooks to you\'re own API\n' +
                                '- 🎁 **Role Rewards** - Auto-assign roles when users vote\n' +
                                '- ⚙️ **Custom Messages** - Fully customizable vote messages\n' +
                                '- 🔗 **Multiple Platforms** - Works with Top.gg, discord.ly, and more',
                        },
                        ...(ctx.isInGuild ? [
                            {
                                type: ComponentType.Separator,
                                spacing: 1,
                            },
                            {
                                type: ComponentType.TextDisplay,
                                content: '## Getting Started',
                            },
                            {
                                type: ComponentType.ActionRow,
                                components: [
                                    {
                                        type: ComponentType.Button,
                                        style: ButtonStyle.Primary,
                                        label: 'Setup',
                                        custom_id: 'help_setup',
                                    },
                                    {
                                        type: ComponentType.Button,
                                        style: ButtonStyle.Secondary,
                                        label: 'List Setups',
                                        custom_id: 'help_list',
                                    },
                                ],
                            }
                        ] : []) as APIComponentInContainer[],
                        {
                            type: ComponentType.Separator,
                            spacing: 1,
                        },
                        {
                            type: ComponentType.TextDisplay,
                            content: 'Need help? Join our support server: https://discord.gg/ZVERh35',
                        }
                    ]
                }
            ],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral,
        });
    }
}