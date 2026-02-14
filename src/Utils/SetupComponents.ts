import {
    APIComponentInContainer,
    APIComponentInMessageActionRow,
    APIModalInteractionResponseCallbackData,
    ButtonStyle,
    ComponentType,
    RESTPostAPIChannelMessageJSONBody
} from "discord-api-types/v10";
import {TSetupState} from "@Utils/SetupManager";
import {TopggConnection} from "@Schemas/Integrations/Topgg";
import {BrightImages} from "@Utils/BrightImages";

function msToReadable(ms) {
    const weeks = Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
    const weeksMs = ms % (7 * 24 * 60 * 60 * 1000);

    const days = Math.floor(weeksMs / (24 * 60 * 60 * 1000));
    const daysMs = weeksMs % (24 * 60 * 60 * 1000);

    const hours = Math.floor(daysMs / (60 * 60 * 1000));
    const hoursMs = daysMs % (60 * 60 * 1000);

    const minutes = Math.floor(hoursMs / (60 * 1000));

    let result = "";
    if (weeks) result += `${weeks} week${weeks > 1 ? 's' : ''} `;
    if (days) result += `${days} day${days > 1 ? 's' : ''} `;
    if (hours) result += `${hours} hour${hours > 1 ? 's' : ''} `;
    if (minutes) result += `${minutes} minute${minutes > 1 ? 's' : ''}`;

    return result.trim();
}

export function buildEntitySelectionStep(setupId: string, hasServerEntity: boolean = false): RESTPostAPIChannelMessageJSONBody {
    return {
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
                                url: BrightImages.Thinking
                            }
                        },
                        components: [
                            {
                                type: ComponentType.TextDisplay,
                                content: '### Votes - Setup Wizard\n-# Entity Select'
                            },
                            {
                                type: ComponentType.TextDisplay,
                                content: `Choose what you want to track votes for:`
                            },
                        ]
                    },
                    {
                        type: ComponentType.Separator,
                        spacing: 1,
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                label: 'Bot',
                                custom_id: `setup_bot_${setupId}`,
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                label: 'Server',
                                custom_id: `setup_server_${setupId}`,
                                disabled: hasServerEntity,
                            },
                            // Later
                            // {
                            //     type: ComponentType.Button,
                            //     style: ButtonStyle.Primary,
                            //     label: 'Game',
                            //     custom_id: `setup_game_${setupId}`,
                            // },
                        ],
                    },
                    {
                        type: ComponentType.Separator,
                        spacing: 1,
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Danger,
                                label: 'Cancel',
                                custom_id: `setup_cancel_${setupId}`,
                            },
                        ],
                    },
                ]
            }
        ],
    };
}

export function buildUnsetupConnectionsStep(setupId: string, connections: TopggConnection[]): RESTPostAPIChannelMessageJSONBody {
    return {
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
                                content: '### Votes - Setup Wizard\n-# Top.gg Connection'
                            },
                            {
                                type: ComponentType.TextDisplay,
                                content: `We found **${connections.length.toLocaleString()}** Top.gg connection${connections.length > 1 ? 's' : ''} linked to your account that ${connections.length > 1 ? 'haven’t' : 'hasn’t'} been configured. Would you like to set one up now?`
                            },
                        ]
                    },
                    {
                        type: ComponentType.Separator,
                        spacing: 1,
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.StringSelect,
                                custom_id: `setup_select_connection_${setupId}`,
                                options: [
                                    ...connections.map((connection) => {
                                        let label = '';
                                        let description = '';

                                        switch (connection.project_type) {
                                            case 'bot':
                                                label = (connection.project_name || connection['bot_username']) ? ('Bot: ' + (connection.project_name || connection['bot_username'])) : `Bot ID: ${connection.project_platform_id}`;
                                                description = 'Click to set up this bot';

                                                break;
                                            case 'server':
                                                label = 'This Server';
                                                description = 'Click to set up this server';

                                                break;
                                            case 'game':
                                                label = connection.project_name ? ('Game: ' + connection.project_name) : ('Game ID: ' + connection.project_platform_id);
                                                description = 'Click to set up this game';

                                                break;
                                        }

                                        return {
                                            label: label,
                                            description: description,
                                            value: `conn_${connection.project_platform_id}`,
                                        };
                                    }),
                                    {
                                        label: "No, I don't want to use this",
                                        description: 'Setup one manually.',
                                        value: 'decline',
                                    }
                                ],
                                placeholder: 'Select a Top.gg connection to set up...',
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Danger,
                                label: 'Cancel',
                                custom_id: `setup_cancel_${setupId}`,
                            },
                        ],
                    },
                ]
            }
        ],
    };
}

export function buildEntityIdStep(setupId: string, entityType: 'bot' | 'server' | 'game'): RESTPostAPIChannelMessageJSONBody {
    return {
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
                                url: BrightImages.Thinking
                            }
                        },
                        components: [
                            {
                                type: ComponentType.TextDisplay,
                                content: '### Votes - Setup Wizard\n-# Entity Select'
                            },
                            {
                                type: ComponentType.TextDisplay,
                                content: (
                                    entityType === 'bot'
                                        ? 'Select the bot you want to track votes for.'
                                        : 'Enter the game ID you want to track votes for.'
                                ) + '\n\n' + (
                                    entityType === 'game'
                                        ? '## ⚠️ Important: Use your Top.gg Game ID\nPlease enter the **Top.gg game ID** from the URL.\n\nExample: For `https://top.gg/roblox/games/796498829106180096`, use `796498829106180096`'
                                        : '')
                            },
                        ]
                    },
                    {
                        type: ComponentType.Separator,
                        spacing: 1
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                label: entityType === 'bot' ? 'Choose bot' : 'Enter ID',
                                custom_id: `setup_enter_entityid_${setupId}`,
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Secondary,
                                label: 'Back',
                                custom_id: `setup_back_${setupId}`,
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Danger,
                                label: 'Cancel',
                                custom_id: `setup_cancel_${setupId}`,
                            },
                        ],
                    }
                ]
            }
        ]
    };
}

export function buildEntityIdModal(setupId: string, entityType: 'bot' | 'server' | 'game'): APIModalInteractionResponseCallbackData {
    const label = entityType === 'bot'
        ? 'Your Bot'
        : entityType === 'server'
            ? 'Your Server ID'
            : 'Your Game ID';

    const description = entityType === 'bot'
        ? 'Enter your actual Discord application'
        : entityType === 'server'
            ? 'Enter your actual Discord server ID'
            : 'Enter the Top.gg game ID from the URL';

    const placeholder = entityType === 'game'
        ? '796498829106180096'
        : 'Paste your ID here...';

    return {
        title: 'Enter your ID',
        custom_id: `setup_modal_entityid_${setupId}`,
        components: [
            entityType === 'bot'
                ? {
                    type: ComponentType.Label,
                    label: label,
                    description: description,
                    component: {
                        type: ComponentType.UserSelect,
                        custom_id: 'entity_id',
                        placeholder: placeholder,
                        required: true,
                        max_values: 1
                    },
                }
                : {
                    type: ComponentType.Label,
                    label: label,
                    description: description,
                    component: {
                        type: ComponentType.TextInput,
                        style: 1,
                        custom_id: 'entity_id',
                        placeholder: placeholder,
                        required: true,
                        max_length: 100,
                    },
                }
        ],
    };
}

export function buildChannelAndWebhookStep(setupId: string, state: TSetupState): RESTPostAPIChannelMessageJSONBody {
    const isEditing = !!state.editing_id;

    return {
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
                                url: BrightImages.Thinking
                            }
                        },
                        components: [
                            {
                                type: ComponentType.TextDisplay,
                                content: '### Votes - Setup Wizard\n-# Channel and Webhook configuration'
                            },
                            {
                                type: ComponentType.TextDisplay,
                                content: 'Configure where votes should be logged or sent externally for your own integration. Both options are optional.',
                            },
                        ]
                    },
                    {
                        type: ComponentType.Separator,
                        spacing: 1,
                    },
                    {
                        type: ComponentType.Section,
                        accessory: {
                            type: ComponentType.Button,
                            style: ButtonStyle.Secondary,
                            label: 'Clear Channel',
                            custom_id: `setup_select_channel_reset_${setupId}`,
                            disabled: !state.channel_id
                        },
                        components: [
                            {
                                type: ComponentType.TextDisplay,
                                content: state.channel_id ? `✅ Channel set (<#${state.channel_id}>)` : 'Select a logging channel (optional)',
                            },
                        ]
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.ChannelSelect,
                                custom_id: `setup_select_channel_${setupId}`,
                                channel_types: [0],
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Secondary,
                                label: 'Test Channel',
                                custom_id: `setup_test_channel_${setupId}`,
                                disabled: !state.channel_id,
                            },
                        ],
                    },
                    {
                        type: ComponentType.Section,
                        accessory: {
                            type: ComponentType.Button,
                            style: ButtonStyle.Secondary,
                            label: 'Set Webhook',
                            custom_id: `setup_enter_webhook_${setupId}`
                        },
                        components: [
                            {
                                type: ComponentType.TextDisplay,
                                content: state.external_webhook_url ? `✅ External webhook set\n> ||${state.external_webhook_url}||` : 'Set a external webhook URL (optional)',
                            },
                        ]
                    },
                    {
                        type: ComponentType.Separator,
                        spacing: 1,
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                label: 'Next',
                                custom_id: `setup_next_${setupId}`,
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Secondary,
                                label: 'Back',
                                custom_id: `setup_back_${setupId}`,
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Danger,
                                label: 'Cancel',
                                custom_id: `setup_cancel_${setupId}`,
                            },
                            ...(isEditing ? [
                                {
                                    type: ComponentType.Button,
                                    style: ButtonStyle.Secondary,
                                    label: 'Dump Settings',
                                    custom_id: `list_dump_${setupId}`,
                                }
                            ] : []) as APIComponentInMessageActionRow[]
                        ],
                    },
                ]
            }
        ],
    };
}

export function buildExternalWebhookModal(setupId: string): APIModalInteractionResponseCallbackData {
    return {
        title: 'Notification Webhook',
        custom_id: `setup_modal_webhook_${setupId}`,
        components: [
            {
                type: ComponentType.TextDisplay,
                content: '**Webhook Payload Information**\n' +
                    'Your webhook will receive POST requests with vote data. All fields listed below are sent in the request body as JSON.\n' +
                    '**Required Fields**\n' +
                    '• entity_type: "bot", "server" or "game"\n• entity_id: Your bot/server ID\n• voter_id: ID of the user who voted\n• platform: Where the vote came from (top.gg, etc.)\n' +
                    '**Optional Fields**\n' +
                    '• guild_id: Server ID (when available)\n• is_test: If its a test event\n• last_vote: UNIX timestamp\n• is_first_vote: If the user voted for the first time\n• count: {all, month, year, week}\n• streak: {best, current, last}\n\nAll optional fields may not always be present!',
            },
            {
                type: ComponentType.Label,
                label: 'Your Webhook URL',
                component: {
                    type: ComponentType.TextInput,
                    style: 1,
                    custom_id: 'webhook_url',
                    placeholder: 'https://your-server.com/vote-notification',
                    required: false,
                    max_length: 2000,
                },
            }
        ],
    };
}

export function buildMessagesStep(setupId: string, state: TSetupState): RESTPostAPIChannelMessageJSONBody {
    const firstVoteMessage = state.messages.find(m => m.type === 'first-vote');
    const voteMessage = state.messages.find(m => m.type === 'vote');
    const isEditing = !!state.editing_id;

    return {
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
                                url: BrightImages.Thinking
                            }
                        },
                        components: [
                            {
                                type: ComponentType.TextDisplay,
                                content: '### Votes - Setup Wizard\n-# Messages'
                            },
                            {
                                type: ComponentType.TextDisplay,
                                content: 'Configure the messages sent when users vote. Votes supports full JSON payloads created at https://discord.builders, or you can just use plain text with variables. Clear the custom messages to use the default messages.'
                            },
                        ]
                    },
                    {
                        type: ComponentType.Separator,
                        spacing: 1,
                    },
                    {
                        type: ComponentType.TextDisplay,
                        content: '**💡 You can use full Discord markdown in your messages.**\n' +
                            'Available variables:\n' +
                            '- `{user.mention}` - <@813913649633951764>\n' +
                            '- `{user.username}` - Votes\n' +
                            '- `{user.id}` - 813913649633951764\n' +
                            '- `{user.avatar}` - 0b58922d67bb06a5924898361a6ff0ff\n' +
                            '- `{user.avatar.animated}` - ?animated=true\n' +
                            '- `{votes.count.all}` - 1000\n' +
                            '- `{votes.count.month}` - 500\n' +
                            '- `{votes.count.year}` - 1000\n' +
                            '- `{votes.count.week}` - 50\n' +
                            '- `{votes.streak.current}` - 12\n' +
                            '- `{votes.streak.best}` - 357\n' +
                            '- `{votes.streak.last}` - 1770667266 (UNIX timestamp)\n' +
                            '- `{entity.type}` - "bot", "server" or "game"\n' +
                            '- `{entity.id}` - 813913649633951764\n' +
                            '- `{new.line}` - a new line, like \\n\n' +
                            '- `{platform}` - top.gg, etc.\n' +
                            '- `{platform.url}` - ex. https://top.gg/bot/813913649633951764\n'
                    },
                    {
                        type: ComponentType.Separator,
                        spacing: 1,
                    },
                    {
                        type: ComponentType.Section,
                        accessory: {
                            type: ComponentType.Button,
                            style: ButtonStyle.Secondary,
                            label: 'Edit',
                            custom_id: `setup_edit_firstvote_${setupId}`,
                        },
                        components: [
                            {
                                type: ComponentType.TextDisplay,
                                content: firstVoteMessage ? '✅ First Vote Message Configured' : 'Using **Default** First Vote Message',
                            },
                        ]
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Secondary,
                                label: 'View First Vote Message',
                                custom_id: `setup_view_firstvote_${setupId}`,
                                disabled: !firstVoteMessage,
                            }
                        ],
                    },
                    {
                        type: ComponentType.Section,
                        accessory: {
                            type: ComponentType.Button,
                            style: ButtonStyle.Secondary,
                            label: 'Edit',
                            custom_id: `setup_edit_vote_${setupId}`,
                        },
                        components: [
                            {
                                type: ComponentType.TextDisplay,
                                content: voteMessage ? '✅ Vote Message Configured' : 'Using **Default** Vote Message',
                            },
                        ]
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Secondary,
                                label: 'View Vote Message',
                                custom_id: `setup_view_vote_${setupId}`,
                                disabled: !voteMessage,
                            }
                        ],
                    },
                    {
                        type: ComponentType.Separator,
                        spacing: 1,
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                label: 'Next',
                                custom_id: `setup_next_${setupId}`,
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Secondary,
                                label: 'Back',
                                custom_id: `setup_back_${setupId}`,
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Danger,
                                label: 'Cancel',
                                custom_id: `setup_cancel_${setupId}`,
                            },
                            ...(isEditing ? [
                                {
                                    type: ComponentType.Button,
                                    style: ButtonStyle.Secondary,
                                    label: 'Dump Settings',
                                    custom_id: `list_dump_${setupId}`,
                                }
                            ] : []) as APIComponentInMessageActionRow[],
                        ],
                    },
                ]
            }
        ],
    };
}

export function buildFirstVoteMessageModal(setupId: string, currentValue: string): APIModalInteractionResponseCallbackData {
    return {
        title: 'First Vote Message',
        custom_id: `setup_modal_firstvote_${setupId}`,
        components: [
            {
                type: ComponentType.TextDisplay,
                content: '**Message Configuration**\n\nYou can use plain text with variables, or provide a JSON payload from [discord.builders](<https://discord.builders>).',
            },
            {
                type: ComponentType.TextDisplay,
                content: '**Available variables**\n' +
                    '- `{user.mention}` - <@813913649633951764>\n' +
                    '- `{user.username}` - Votes\n' +
                    '- `{user.id}` - 813913649633951764\n' +
                    '- `{user.avatar}` - 0b58922d67bb06a5924898361a6ff0ff\n' +
                    '- `{user.avatar.animated}` - ?animated=true\n' +
                    '- `{votes.count.all}` - 1000\n' +
                    '- `{votes.count.month}` - 500\n' +
                    '- `{votes.count.year}` - 1000\n' +
                    '- `{votes.count.week}` - 50\n' +
                    '- `{votes.streak.current}` - 12\n' +
                    '- `{votes.streak.best}` - 357\n' +
                    '- `{votes.streak.last}` - 1770667266 (UNIX timestamp)\n' +
                    '- `{entity.type}` - "bot", "server" or "game"\n' +
                    '- `{entity.id}` - 813913649633951764\n' +
                    '- `{new.line}` - a new line, like \\n\n' +
                    '- `{platform}` - top.gg, etc.\n' +
                    '- `{platform.url}` - ex. https://top.gg/bot/813913649633951764'
            },
            {
                type: ComponentType.TextDisplay,
                content: '> 💡 Supports Components v2 JSON payloads. Paste an array from discord.builders and it will be auto-wrapped!',
            },
            {
                type: ComponentType.Label,
                label: 'Your Message',
                description: 'Plain text or JSON payload',
                component: {
                    type: ComponentType.TextInput,
                    style: 2,
                    custom_id: 'message',
                    placeholder: '{user.mention} has voted for the first time! 🎉',
                    value: currentValue || undefined,
                    required: false,
                    max_length: 4000,
                },
            },
        ],
    };
}

export function buildVoteMessageModal(setupId: string, currentValue: string): APIModalInteractionResponseCallbackData {
    return {
        title: 'Vote Message',
        custom_id: `setup_modal_vote_${setupId}`,
        components: [
            {
                type: ComponentType.TextDisplay,
                content: '**Message Configuration**\n\nYou can use plain text with variables, or provide a JSON payload from [discord.builders](<https://discord.builders>).',
            },
            {
                type: ComponentType.TextDisplay,
                content: '**Available variables**\n' +
                    '- `{user.mention}` - <@813913649633951764>\n' +
                    '- `{user.username}` - Votes\n' +
                    '- `{user.id}` - 813913649633951764\n' +
                    '- `{user.avatar}` - 0b58922d67bb06a5924898361a6ff0ff\n' +
                    '- `{user.avatar.animated}` - ?animated=true\n' +
                    '- `{votes.count.all}` - 1000\n' +
                    '- `{votes.count.month}` - 500\n' +
                    '- `{votes.count.year}` - 1000\n' +
                    '- `{votes.count.week}` - 50\n' +
                    '- `{votes.streak.current}` - 12\n' +
                    '- `{votes.streak.best}` - 357\n' +
                    '- `{votes.streak.last}` - 1770667266 (UNIX timestamp)\n' +
                    '- `{entity.type}` - "bot", "server" or "game"\n' +
                    '- `{entity.id}` - 813913649633951764\n' +
                    '- `{new.line}` - a new line, like \\n\n' +
                    '- `{platform}` - top.gg, etc.\n' +
                    '- `{platform.url}` - ex. https://top.gg/bot/813913649633951764'
            },
            {
                type: ComponentType.TextDisplay,
                content: '> 💡 Supports Components v2 JSON payloads. Paste an array from discord.builders and it will be auto-wrapped!',
            },
            {
                type: ComponentType.Label,
                label: 'Your Message',
                description: 'Plain text or JSON payload',
                component: {
                    type: ComponentType.TextInput,
                    style: 2,
                    custom_id: 'message',
                    placeholder: '{user.mention} has voted! Total votes: {votes.count.all}',
                    value: currentValue || undefined,
                    required: false,
                    max_length: 4000,
                },
            },
        ],
    };
}

export function buildRewardsStep(setupId: string, state: TSetupState): RESTPostAPIChannelMessageJSONBody {
    const rewardsCount = state.rewards.length;
    const isEditing = !!state.editing_id;

    return {
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
                                url: rewardsCount >= 1 ? BrightImages.Clock : BrightImages.Thinking
                            }
                        },
                        components: [
                            {
                                type: ComponentType.TextDisplay,
                                content: '### Votes - Setup Wizard\n-# Rewards\n' +
                                    'Users will receive these roles when voting. You can set minimum vote requirements.'
                            }
                        ]
                    },
                    {
                        type: ComponentType.Separator,
                        spacing: 1,
                    },
                    ...(rewardsCount >= 25 ? [] : [
                        {
                            type: ComponentType.ActionRow,
                            components: [
                                {
                                    type: ComponentType.Button,
                                    style: ButtonStyle.Success,
                                    label: 'Add Reward Role',
                                    custom_id: `setup_add_reward_${setupId}`
                                },
                            ],
                        },
                    ]) as APIComponentInContainer[],
                    ...(state.rewards.length > 0 ? state.rewards.map((role, index) => {
                        return {
                            type: ComponentType.Section,
                            components: [
                                {
                                    type: ComponentType.TextDisplay,
                                    content: `${index + 1}. <@&${role.role_id}>${role.min_votes > 0 ? ` (min. ${role.min_votes} votes)` : ''}${role.duration_min > 0 ? ` (${msToReadable(role.duration_min * 60 * 1000)})` : ''}`,
                                },
                            ],
                            accessory: {
                                type: ComponentType.Button,
                                style: ButtonStyle.Danger,
                                label: 'Remove',
                                custom_id: `setup_remove_reward_${setupId}_${index}`,
                            },
                        }
                    }) : []) as APIComponentInContainer[],
                    {
                        type: ComponentType.TextDisplay,
                        content: `-# ${rewardsCount}/25 configure reward roles`
                    },
                    {
                        type: ComponentType.Separator,
                        spacing: 1,
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                label: 'Next',
                                custom_id: `setup_next_${setupId}`,
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Secondary,
                                label: 'Back',
                                custom_id: `setup_back_${setupId}`,
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Danger,
                                label: 'Cancel',
                                custom_id: `setup_cancel_${setupId}`,
                            },
                            ...(isEditing ? [
                                {
                                    type: ComponentType.Button,
                                    style: ButtonStyle.Secondary,
                                    label: 'Dump Settings',
                                    custom_id: `list_dump_${setupId}`,
                                }
                            ] : []) as APIComponentInMessageActionRow[],
                        ],
                    },
                ]
            }
        ]
    };
}

export function buildAddRewardModal(setupId: string): APIModalInteractionResponseCallbackData {
    return {
        title: 'Add Reward Role',
        custom_id: `setup_modal_addreward_${setupId}`,
        components: [
            {
                type: ComponentType.Label,
                label: 'Role to reward',
                component: {
                    type: ComponentType.RoleSelect,
                    custom_id: 'role_id',
                    placeholder: 'Select a role to reward',
                    min_values: 1,
                    max_values: 1,
                },
            },
            {
                type: ComponentType.Label,
                label: 'Minimum votes required (optional)',
                description: 'Leave empty for no minimum',
                component: {
                    type: ComponentType.TextInput,
                    style: 1,
                    custom_id: 'min_votes',
                    placeholder: '5',
                    required: false,
                    max_length: 10,
                },
            },
            {
                type: ComponentType.Label,
                label: 'Duration in minutes (optional)',
                description: 'Leave empty for permanent role',
                component: {
                    type: ComponentType.TextInput,
                    style: 1,
                    custom_id: 'duration_min',
                    placeholder: '60',
                    required: false,
                    max_length: 10,
                },
            },
        ],
    };
}

export function buildCompleteStep(setupId: string, state: TSetupState): RESTPostAPIChannelMessageJSONBody {
    const isEditing = !!state.editing_id;
    const isDisabled = state.disable;
    let configSummary = [
        `**Configuration for:** ${state.entity_type === 'bot' ? `<@${state.entity_id}>` : (state.entity_type === 'server' ? `this server` : `Roblox Game ${state.entity_id}`)}`,
        state.channel_id ? `**Logging Channel:** <#${state.channel_id}>` : '**Logging Channel:** Not set',
        state.external_webhook_url ? `**External Webhook:** Set` : '**External Webhook:** Not set',
        state.rewards.length > 0 ? `**Reward Roles:** ${state.rewards.length}` : '**Reward Roles:** None',
        state.messages.length > 0 ? `**Messages:** ${state.messages.length} configured` : '**Messages:** Defaults',

    ].join('\n');

    if (isEditing) {
        configSummary = (
            (
                isDisabled
                    ? '**Status:** 🔴 Disabled'
                    : '**Status:** ✅ Enabled'
            )
            + '\n' + configSummary
        );
    }

    const entityType = state.entity_type || 'bot';

    const lists: APIComponentInMessageActionRow[] = [];
    if (entityType === 'bot' || entityType === 'server' || entityType === 'game') {
        lists.push({
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            label: 'Top.gg',
            emoji: {name: 'botlisttopgg', id: '1472359122232934460'},
            custom_id: `setup_platform_topgg_${setupId}`,
        });
    }

    if (entityType === 'bot' || entityType === 'server') {
        lists.push({
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            label: 'DiscordBotList.com',
            emoji: {name: 'botlistdbl', id: '1472359096454877340'},
            custom_id: `setup_platform_discordbotlist_${setupId}`,
        });

        lists.push({
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            label: 'Discords.com',
            emoji: {name: 'botlistdiscords', id: '1472359137479229466'},
            custom_id: `setup_platform_discordscom_${setupId}`,
        });
    }

    return {
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
                                url: BrightImages.ThumbsUp
                            }
                        },
                        components: [
                            {
                                type: ComponentType.TextDisplay,
                                content: '### Votes - Setup Wizard\n-# Platform Integration'
                            },
                            {
                                type: ComponentType.TextDisplay,
                                content: 'Just one last step: Review your configuration, make sure everything is set up the way you like it, and choose the platform you’d like to integrate "Votes" with. You can connect multiple platforms if you want.'
                            }
                        ]
                    },
                    {
                        type: ComponentType.Separator,
                        spacing: 1,
                    },
                    {
                        type: ComponentType.TextDisplay,
                        content: configSummary,
                    },
                    {
                        type: ComponentType.Separator,
                        spacing: 1,
                    },
                    {
                        type: ComponentType.TextDisplay,
                        content: '## Choose Your Platform',
                    },
                    {
                        type: ComponentType.TextDisplay,
                        content: 'Select a voting platform to connect your webhook. Click on a platform to see detailed instructions.',
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            ...lists,
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Link,
                                label: 'Need a different platform?',
                                url: 'https://discord.gg/ZVERh35',
                            },
                        ],
                    },
                    {
                        type: ComponentType.Separator,
                        spacing: 1,
                    },
                    ...(isEditing ? [
                        {
                            type: ComponentType.TextDisplay,
                            content: '### Danger Zone',
                        },
                        {
                            type: ComponentType.ActionRow,
                            components: [
                                {
                                    type: ComponentType.Button,
                                    style: ButtonStyle.Danger,
                                    label: (isDisabled ? 'Enable' : 'Disable') + ' Setup',
                                    custom_id: `list_toggle_${isDisabled ? 'enable' : 'disable'}_${setupId}`,
                                },
                                {
                                    type: ComponentType.Button,
                                    style: ButtonStyle.Danger,
                                    label: 'Delete Setup',
                                    custom_id: `list_delete_${setupId}`,
                                },
                            ],
                        },
                        {
                            type: ComponentType.Separator,
                            spacing: 1,
                        },
                    ] : []) as APIComponentInContainer[],
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Success,
                                label: (isEditing ? (isDisabled ? 'Enable & Save' : 'Save Changes') : 'Finish Setup'),
                                custom_id: `setup_finish_${setupId}`,
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Secondary,
                                label: 'Back',
                                custom_id: `setup_back_${setupId}`,
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Danger,
                                label: 'Cancel',
                                custom_id: `setup_cancel_${setupId}`,
                            },
                            ...(isEditing ? [
                                {
                                    type: ComponentType.Button,
                                    style: ButtonStyle.Secondary,
                                    label: 'Dump Settings',
                                    custom_id: `list_dump_${setupId}`,
                                }
                            ] : []) as APIComponentInMessageActionRow[],
                        ],
                    },
                ]
            },
        ],
    };
}

export function buildPlatformTopGGGuide(setupId: string, state: TSetupState, webhookUrl: string, maskedToken: string, hasExistingConnection = false): RESTPostAPIChannelMessageJSONBody {
    const entityType = state.entity_type === 'bot' ? 'bot' : state.entity_type === 'server' ? 'server' : 'roblox/games';
    const entityId = state.entity_id || '';
    const isGame = state.entity_type === 'game';

    const components: any[] = [
        {
            type: ComponentType.TextDisplay,
            content: '# Connect to top.gg',
        },
        {
            type: ComponentType.Container,
            accent_color: 5763719,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: '## Step-by-Step Guide',
                },
            ],
        },
    ];

    if (hasExistingConnection) {
        components.push({
            type: ComponentType.Container,
            accent_color: 5763719,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: '## ✅ Already Connected!\nA top.gg connection for this entity already exists. Everything is set up and you\'re ready to go - no further action needed!',
                },
            ],
        });
    } else {
        const integrationsUrl = `https://top.gg/${isGame ? 'roblox/games' : 'discord'}/${entityType}/${entityId}/dashboard/integrations`;
        components.push({
            type: ComponentType.TextDisplay,
            content: `### 1. Visit the Integrations Page\nNavigate to:\n<${integrationsUrl}>\n`,
        });
        components.push({
            type: ComponentType.Separator,
            spacing: 1,
        });
        components.push({
            type: ComponentType.TextDisplay,
            content: '### 2. Find the "Votes" Bot\nLook for the bot named **"Votes"** in the integrations list.',
        });
        components.push({
            type: ComponentType.Separator,
            spacing: 1,
        });
        components.push({
            type: ComponentType.TextDisplay,
            content: '### 3. Click "Install"\nClick the **"Install"** button on the "Votes" bot to connect it.\n\n> 💡 No URL or webhook configuration needed - just install the "Votes" bot!',
        });
    }

    components.push({
        type: ComponentType.Separator,
        spacing: 1,
    });
    components.push({
        type: ComponentType.ActionRow,
        components: [
            {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                label: 'Back',
                custom_id: `setup_platform_back_${setupId}`,
            },
            {
                type: ComponentType.Button,
                style: ButtonStyle.Success,
                label: 'Finish Setup',
                custom_id: `setup_finish_${setupId}`,
            },
        ],
    });

    return {components};
}

export function buildPlatformDiscordBotListGuide(setupId: string, state: TSetupState, webhookUrl: string, maskedToken: string): RESTPostAPIChannelMessageJSONBody {
    const entityId = state.entity_id || '';

    return {
        components: [
            {
                type: ComponentType.TextDisplay,
                content: '# Connect to discordbotlist.com',
            },
            {
                type: ComponentType.Container,
                accent_color: 5763719,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: '## Step-by-Step Guide',
                    },
                ],
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.TextDisplay,
                content: `### 1. Visit Your Bot Page\nNavigate to:\n<https://discordbotlist.com/bots/${entityId}/edit>\n`,
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.TextDisplay,
                content: '### 2. Go to Webhook Settings\nLook for "Upvote Webhook" in your bot dashboard.',
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.TextDisplay,
                content: `### 3. Add Your Webhook URL\nEnter the following URL:\n\`\`\`\n${webhookUrl}\n\`\`\`\n\nThe auth token is included in the URL automatically.`,
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Secondary,
                        label: 'Back',
                        custom_id: `setup_platform_back_${setupId}`,
                    },
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Success,
                        label: 'Finish Setup',
                        custom_id: `setup_finish_${setupId}`,
                    },
                ],
            },
        ],
    };
}

export function buildPlatformDiscordsComGuide(setupId: string, state: TSetupState, webhookUrl: string, maskedToken: string): RESTPostAPIChannelMessageJSONBody {
    const entityType = state.entity_type === 'bot' ? 'bot' : 'servers'; // Note: discords.com uses "servers" not "server"
    const entityId = state.entity_id || '';

    return {
        components: [
            {
                type: ComponentType.TextDisplay,
                content: '# Connect to discords.com',
            },
            {
                type: ComponentType.Container,
                accent_color: 5763719,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: '## Step-by-Step Guide',
                    },
                ],
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.TextDisplay,
                content: `### 1. Visit the Integrations Page\nNavigate to:\n<https://discords.com/${entityType}/${entityId}/dashboard/integrations>`,
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.TextDisplay,
                content: '### 2. Find Vote Webhooks\nLook for "Vote Webhooks" or "Webhooks" section in the integrations.',
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.TextDisplay,
                content: `### 3. Add Your Webhook URL\nEnter the following URL:\n\`\`\`\n${webhookUrl}\n\`\`\`\n\nThe auth token is included in the URL automatically.`,
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.TextDisplay,
                content: '> 💡 discords.com supports both bots and servers. Make sure you select the correct entity type!',
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Secondary,
                        label: 'Back',
                        custom_id: `setup_platform_back_${setupId}`,
                    },
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Success,
                        label: 'Finish Setup',
                        custom_id: `setup_finish_${setupId}`,
                    },
                ],
            },
        ],
    };
}
