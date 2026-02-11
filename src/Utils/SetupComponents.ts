import {
    APIMessageTopLevelComponent,
    APIModalInteractionResponseCallbackData,
    ButtonStyle,
    ComponentType,
    RESTPostAPIChannelMessageJSONBody
} from "discord-api-types/v10";
import {TSetupState} from "@Utils/SetupManager";

export function buildEntitySelectionStep(setupId: string): RESTPostAPIChannelMessageJSONBody {
    return {
        components: [
            {
                type: ComponentType.TextDisplay,
                content: '# Setup Vote Tracking',
            },
            {
                type: ComponentType.TextDisplay,
                content: 'Choose what you want to track votes for:',
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
        ],
    };
}

export function buildEntityIdStep(setupId: string, entityType: 'bot' | 'server' | 'game', preFetchedEntityId: string | null = null): RESTPostAPIChannelMessageJSONBody {
    const description = entityType === 'bot'
        ? 'Enter the bot ID you want to track votes for.'
        : entityType === 'server'
            ? 'Enter the server ID you want to track votes for.'
            : 'Enter the game ID you want to track votes for.';

    const idHint = entityType === 'bot'
        ? '## ⚠️ Important: Use Your Real Discord ID\nPlease enter your **actual Discord application ID** (for bots).\n\n**Do NOT** use the ID from the top.gg URL - those are different from your actual Discord IDs!'
        : entityType === 'server'
            ? '## ⚠️ Important: Use Your Real Discord ID\nPlease enter your **actual Discord server ID**.\n\n**Do NOT** use the ID from the top.gg URL - those are different from your actual Discord IDs!'
            : '## ⚠️ Important: Use Your top.gg Game ID\nPlease enter the **top.gg game ID** from the URL.\n\nExample: For `https://top.gg/roblox/games/796498829106180096`, use `796498829106180096`';

    const components: any[] = [
        {
            type: ComponentType.TextDisplay,
            content: `# Setup Vote Tracking - Step 2/6`,
        },
        {
            type: ComponentType.TextDisplay,
            content: description,
        },
    ];

    if (preFetchedEntityId) {
        components.push({
            type: ComponentType.Container,
            accent_color: 5763719,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `## ✅ Found Existing Connection!\nWe found an existing Top.gg connection for your account.\n\n**${entityType === 'bot' ? 'Bot' : 'Server'} ID:** \`${preFetchedEntityId}\`\n\nYou can use this ID or enter a different one.`,
                },
            ],
        });

        components.push({
            type: ComponentType.Separator,
            spacing: 1,
        });

        components.push({
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Success,
                    label: 'Use this ID',
                    custom_id: `setup_use_prefetched_id_${setupId}`,
                },
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Primary,
                    label: 'Enter different ID',
                    custom_id: `setup_enter_entityid_${setupId}`,
                },
            ],
        });
    } else {
        components.push({
            type: ComponentType.Container,
            accent_color: 15548997,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: idHint,
                },
            ],
        });

        components.push({
            type: ComponentType.Separator,
            spacing: 1,
        });

        components.push({
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Primary,
                    label: 'Enter ID',
                    custom_id: `setup_enter_entityid_${setupId}`,
                },
            ],
        });
    }

    components.push({
        type: ComponentType.ActionRow,
        components: [
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
    });

    return {components};
}

export function buildEntityIdModal(setupId: string, entityType: 'bot' | 'server' | 'game'): APIModalInteractionResponseCallbackData {
    const label = entityType === 'bot'
        ? 'Your Bot ID'
        : entityType === 'server'
            ? 'Your Server ID'
            : 'Your Game ID';

    const description = entityType === 'bot'
        ? 'Enter your actual Discord application ID'
        : entityType === 'server'
            ? 'Enter your actual Discord server ID'
            : 'Enter the top.gg game ID from the URL';

    const placeholder = entityType === 'game'
        ? '796498829106180096'
        : 'Paste your ID here...';

    return {
        title: 'Enter Your ID',
        custom_id: `setup_modal_entityid_${setupId}`,
        components: [
            {
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
            },
        ],
    };
}

export function buildChannelAndWebhookStep(setupId: string, state: TSetupState): RESTPostAPIChannelMessageJSONBody {
    const channelText = state.channel_id ? `✅ Channel set` : 'Select logging channel (optional)';
    const webhookText = state.external_webhook_url ? '✅ External webhook set' : 'Set external webhook URL (optional)';
    const isEditing = !!state.editing_id;

    const actionRowComponents = [
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
    ] as any;

    if (isEditing) {
        actionRowComponents.splice(2, 0, {
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            label: 'Dump JSON',
            custom_id: `list_dump_${setupId}`,
        });
    }

    return {
        components: [
            {
                type: ComponentType.TextDisplay,
                content: `# ${isEditing ? 'Edit' : 'Setup'} Vote Tracking - Step 3/6`,
            },
            {
                type: ComponentType.TextDisplay,
                content: 'Configure where votes should be logged. Both options are optional.',
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.Container,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `${channelText}`,
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
                        type: ComponentType.TextDisplay,
                        content: `${webhookText}`,
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Success,
                                label: 'Set External Webhook',
                                custom_id: `setup_enter_webhook_${setupId}`,
                                disabled: !!state.external_webhook_url,
                            },
                        ],
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
                        style: ButtonStyle.Secondary,
                        label: 'Test Channel',
                        custom_id: `setup_test_channel_${setupId}`,
                        disabled: !state.channel_id,
                    },
                ],
            },
            {
                type: ComponentType.ActionRow,
                components: actionRowComponents,
            },
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
                    '• entity_type: "bot" or "server"\n• entity_id: Your bot/server ID\n• voter_id: ID of the user who voted\n• platform: Where the vote came from (top.gg, etc.)\n' +
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

    const firstVoteStatus = firstVoteMessage ? '✅ Configured' : 'Default';
    const voteStatus = voteMessage ? '✅ Configured' : 'Default';
    const isEditing = !!state.editing_id;

    const actionRowComponents = [
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
    ] as any;

    if (isEditing) {
        actionRowComponents.splice(2, 0, {
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            label: 'Dump JSON',
            custom_id: `list_dump_${setupId}`,
        });
    }

    return {
        components: [
            {
                type: ComponentType.TextDisplay,
                content: `# ${isEditing ? 'Edit' : 'Setup'} Vote Tracking - Step 4/6`,
            },
            {
                type: ComponentType.TextDisplay,
                content: 'Configure the messages sent when users vote. This supports full JSON payloads even with flags.',
            },
            {
                type: ComponentType.TextDisplay,
                content: '>>> 💡 Messages use Discord markdown.\n' +
                    'Available variables:\n' +
                    '- {user.mention} - <@813913649633951764>\n' +
                    '- {user.username} - Votes\n' +
                    '- {user.id} - 813913649633951764\n' +
                    '- {user.avatar} - 0b58922d67bb06a5924898361a6ff0ff\n' +
                    '- {user.avatar.animated} - ?animated=true\n' +
                    '- {votes.count.all} - 1000\n' +
                    '- {votes.count.month} - 500\n' +
                    '- {votes.count.year} - 1000\n' +
                    '- {votes.count.week} - 50\n' +
                    '- {votes.streak.current} - 12\n' +
                    '- {votes.streak.best} - 357\n' +
                    '- {votes.streak.last} - 1770667266 (UNIX timestamp)\n' +
                    '- {entity.type} - "bot" or "server"\n' +
                    '- {entity.id} - 813913649633951764\n' +
                    '- {platform} - top.gg, etc.\n'
            },
            {
                type: ComponentType.TextDisplay,
                content: '> 💡 The bot fully supports components and/or embeds in these messages. Provide the raw JSON payload as you would send to Discord\'s API. You can also use <https://discord.builders>',
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.Container,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `🎉 First Vote Message - ${firstVoteStatus}`,
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                label: 'Edit First Vote Message',
                                custom_id: `setup_edit_firstvote_${setupId}`,
                            },
                        ],
                    },
                ],
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.Container,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `📊 Vote Message - ${voteStatus}`,
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                label: 'Edit Vote Message',
                                custom_id: `setup_edit_vote_${setupId}`,
                            },
                        ],
                    },
                ],
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.ActionRow,
                components: actionRowComponents,
            },
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
                    '- {user.mention} - <@813913649633951764>\n' +
                    '- {user.username} - Votes\n' +
                    '- {user.id} - 813913649633951764\n' +
                    '- {user.avatar} - 0b58922d67bb06a5924898361a6ff0ff\n' +
                    '- {user.avatar.animated} - ?animated=true\n' +
                    '- {votes.count.all} - 1000\n' +
                    '- {votes.count.month} - 500\n' +
                    '- {votes.count.year} - 1000\n' +
                    '- {votes.count.week} - 50\n' +
                    '- {votes.streak.current} - 12\n' +
                    '- {votes.streak.best} - 357\n' +
                    '- {votes.streak.last} - 1770667266 (UNIX timestamp)\n' +
                    '- {entity.type} - "bot" or "server"\n' +
                    '- {entity.id} - 813913649633951764\n' +
                    '- {platform} - top.gg, etc.\n'
            },
            {
                type: ComponentType.TextDisplay,
                content: '> 💡 Supports Components v2 JSON payloads. Paste an array from discord.builders and it will be auto-wrapped with the correct flags!',
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
                    '- {user.mention} - <@813913649633951764>\n' +
                    '- {user.username} - Votes\n' +
                    '- {user.id} - 813913649633951764\n' +
                    '- {user.avatar} - 0b58922d67bb06a5924898361a6ff0ff\n' +
                    '- {user.avatar.animated} - ?animated=true\n' +
                    '- {votes.count.all} - 1000\n' +
                    '- {votes.count.month} - 500\n' +
                    '- {votes.count.year} - 1000\n' +
                    '- {votes.count.week} - 50\n' +
                    '- {votes.streak.current} - 12\n' +
                    '- {votes.streak.best} - 357\n' +
                    '- {votes.streak.last} - 1770667266 (UNIX timestamp)\n' +
                    '- {entity.type} - "bot" or "server"\n' +
                    '- {entity.id} - 813913649633951764\n' +
                    '- {platform} - top.gg, etc.\n'
            },
            {
                type: ComponentType.TextDisplay,
                content: '> 💡 Supports Components v2 JSON payloads. Paste an array from discord.builders and it will be auto-wrapped with the correct flags!',
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

    const components: APIMessageTopLevelComponent[] = [
        {
            type: ComponentType.TextDisplay,
            content: `# ${isEditing ? 'Edit' : 'Setup'} Vote Tracking - Step 5/6`,
        },
        {
            type: ComponentType.TextDisplay,
            content: `Configure reward roles (${rewardsCount}/25 added)`,
        },
        {
            type: ComponentType.TextDisplay,
            content: '> 💡 Users will receive these roles when voting. You can set minimum vote requirements.',
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
                    style: ButtonStyle.Success,
                    label: 'Add Reward Role',
                    custom_id: `setup_add_reward_${setupId}`,
                    disabled: rewardsCount >= 25,
                },
            ],
        },
    ];

    if (rewardsCount > 0) {
        components.push({
            type: ComponentType.TextDisplay,
            content: `## Current Rewards (${rewardsCount})`,
        });

        for (let i = 0; i < state.rewards.length; i++) {
            const r = state.rewards[i];
            components.push({
                type: ComponentType.Section,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `${i + 1}. <@&${r.role_id}>${r.min_votes > 0 ? ` (min ${r.min_votes} votes)` : ''}${r.duration_min > 0 ? ` (${r.duration_min} min)` : ''}`,
                    },
                ],
                accessory: {
                    type: ComponentType.Button,
                    style: ButtonStyle.Danger,
                    label: 'Remove',
                    custom_id: `setup_remove_reward_${setupId}_${i}`,
                },
            });
        }
    }

    components.push({
        type: ComponentType.Separator,
        spacing: 1,
    });

    const actionRowComponents = [
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
    ] as any;

    if (isEditing) {
        actionRowComponents.splice(2, 0, {
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            label: 'Dump JSON',
            custom_id: `list_dump_${setupId}`,
        });
    }

    components.push({
        type: ComponentType.ActionRow,
        components: actionRowComponents,
    });

    return {components};
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
    const configSummary = [
        `**Type:** ${state.entity_type === 'bot' ? 'Bot' : state.entity_type === 'server' ? 'Server' : 'Game'}`,
        `**Entity ID:** ${state.entity_id}`,
        state.channel_id ? `**Logging Channel:** <#${state.channel_id}>` : '**Logging Channel:** Not set',
        state.external_webhook_url ? `**External Webhook:** Set` : '**External Webhook:** Not set',
        state.rewards.length > 0 ? `**Reward Roles:** ${state.rewards.length}` : '**Reward Roles:** None',
        state.messages.length > 0 ? `**Messages:** ${state.messages.length} configured` : '**Messages:** Defaults',
    ].join('\n');

    const entityType = state.entity_type || 'bot';
    const showDiscordBotList = entityType === 'bot' || entityType === 'game';

    return {
        components: [
            {
                type: ComponentType.TextDisplay,
                content: '# Setup Complete! 🎉',
            },
            {
                type: ComponentType.Container,
                accent_color: 5763719,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `## Configuration Summary\n${configSummary}`,
                    },
                ],
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
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Primary,
                        label: 'top.gg',
                        emoji: {name: '🔗'},
                        custom_id: `setup_platform_topgg_${setupId}`,
                    },
                    ...(showDiscordBotList ? [{
                        type: ComponentType.Button,
                        style: ButtonStyle.Primary,
                        label: 'discordbotlist.com',
                        emoji: {name: '🔗'},
                        custom_id: `setup_platform_discordbotlist_${setupId}`,
                    } as const] : []),
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Primary,
                        label: 'discords.com',
                        emoji: {name: '🔗'},
                        custom_id: `setup_platform_discordscom_${setupId}`,
                    },
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Link,
                        label: 'Need a different platform?',
                        url: 'https://discord.gg/ZVERh35',
                    },
                ],
            },
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Success,
                        label: 'Finish Setup',
                        custom_id: `setup_finish_${setupId}`,
                    },
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Danger,
                        label: 'Cancel',
                        custom_id: `setup_cancel_${setupId}`,
                    },
                ],
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
