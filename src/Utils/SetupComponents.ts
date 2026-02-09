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

export function buildEntityIdStep(setupId: string, entityType: 'bot' | 'server'): RESTPostAPIChannelMessageJSONBody {
    const description = entityType === 'bot'
        ? 'Enter the bot ID you want to track votes for.'
        : 'Enter the server ID you want to track votes for.';

    return {
        components: [
            {
                type: ComponentType.TextDisplay,
                content: `# Setup Vote Tracking - Step 2/6`,
            },
            {
                type: ComponentType.TextDisplay,
                content: description,
            },
            {
                type: ComponentType.Container,
                accent_color: 15548997,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: '## ⚠️ Important: Use Your Real Discord ID\nPlease enter your **actual Discord application ID** (for bots) or **Discord server ID** (for servers).\n\n**Do NOT** use the ID from the top.gg URL - those are different from your actual Discord IDs!',
                    },
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
                        label: 'Enter ID',
                        custom_id: `setup_enter_entityid_${setupId}`,
                    },
                ],
            },
            {
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
            },
        ],
    };
}

export function buildEntityIdModal(setupId: string): APIModalInteractionResponseCallbackData {
    return {
        title: 'Enter Your ID',
        custom_id: `setup_modal_entityid_${setupId}`,
        components: [
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.TextInput,
                        style: 1,
                        custom_id: 'entity_id',
                        label: 'Your Bot or Server ID',
                        placeholder: 'Paste your ID here...',
                        required: true,
                        max_length: 100,
                    },
                ],
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
                        content: `📢 ${channelText}`,
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
                        style: ButtonStyle.Success,
                        label: 'Set External Webhook',
                        custom_id: `setup_enter_webhook_${setupId}`,
                        disabled: !!state.external_webhook_url,
                    },
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
                    '• entity_type: "bot" or "server"\n• entity_id: Your bot/server ID\n• voterId: ID of the user who voted\n• platform: Where the vote came from (top.gg, etc.)\n' +
                    '**Optional Fields**\n' +
                    '• guildId: Server ID (when available)\n• count: {all, thisMonth, thisYear, thisWeek}\n• streak: {best, current, lastVote}\n\nAll optional fields may not always be present!',
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
                    '- {user.displayName} - Votes\n' +
                    '- {user.id} - 813913649633951764\n' +
                    '- {user.avatarUrl} - <https://cdn.discordapp.com/avatars/813913649633951764/0b58922d67bb06a5924898361a6ff0ff.webp>\n' +
                    '- {votes.count.all} - 1000\n' +
                    '- {votes.count.thisMonth} - 500\n' +
                    '- {votes.count.thisYear} - 1000\n' +
                    '- {votes.count.thisWeek} - 50\n' +
                    '- {votes.streak.current} - 12\n' +
                    '- {votes.streak.best} - 357\n' +
                    '- {votes.lastVote} - 1770667266 (UNIX timestamp)\n' +
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
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.TextInput,
                        style: 2,
                        custom_id: 'message',
                        label: 'Message shown on first vote',
                        placeholder: '{user.mention} has voted for the first time! 🎉',
                        value: currentValue || undefined,
                        required: false,
                        max_length: 2000,
                    },
                ],
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
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.TextInput,
                        style: 2,
                        custom_id: 'message',
                        label: 'Message shown on every vote',
                        placeholder: '{user.mention} has voted! Total votes: {votes.count.all}',
                        value: currentValue || undefined,
                        required: false,
                        max_length: 2000,
                    },
                ],
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
        `**Type:** ${state.entity_type === 'bot' ? 'Bot' : 'Server'}`,
        `**Entity ID:** ${state.entity_id}`,
        state.channel_id ? `**Logging Channel:** <#${state.channel_id}>` : '**Logging Channel:** Not set',
        state.external_webhook_url ? `**External Webhook:** Set` : '**External Webhook:** Not set',
        state.rewards.length > 0 ? `**Reward Roles:** ${state.rewards.length}` : '**Reward Roles:** None',
        state.messages.length > 0 ? `**Messages:** ${state.messages.length} configured` : '**Messages:** Defaults',
    ].join('\n');

    const entityType = state.entity_type || 'bot';
    const showDiscordBotList = entityType === 'bot';

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
    const entityType = state.entity_type === 'bot' ? 'bot' : 'server';
    const entityId = state.entity_id || '';

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
        components.push({
            type: ComponentType.TextDisplay,
            content: `### 1. Visit the Integrations Page\nNavigate to:\n<https://top.gg/discord/${entityType}/${entityId}/dashboard/integrations>\n`,
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
