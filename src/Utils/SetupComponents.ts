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
    const title = entityType === 'bot' ? 'Enter Your Bot ID' : 'Enter Your Server ID';
    const description = entityType === 'bot'
        ? 'Enter the bot ID you want to track votes for.'
        : 'Enter the server ID you want to track votes for.';
    const hint = entityType === 'bot'
        ? '> 💡 You can find this in the URL of your bot page on the voting platform.'
        : '> 💡 You can find this in the URL of your server page on the voting platform.';

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
                type: ComponentType.TextDisplay,
                content: hint,
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
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.TextInput,
                        style: 1,
                        custom_id: 'webhook_url',
                        label: 'Your Webhook URL',
                        placeholder: 'https://your-server.com/vote-notification',
                        required: false,
                        max_length: 500,
                    },
                ],
            },
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
                    '- {user.mention}\n' +
                    '- {user.displayName}\n' +
                    '- {user.id}\n' +
                    '- {votes.count.all}\n' +
                    '- {votes.count.thisMonth}\n' +
                    '- {votes.count.thisYear}\n' +
                    '- {votes.count.thisWeek}\n' +
                    '- {votes.lastVote}\n' +
                    '- {entity.name}\n' +
                    '- {entity.id}\n' +
                    '- {platform}\n'
            },
            {
                type: ComponentType.TextDisplay,
                content: '> 💡 The bot fully supports components and/or embeds in these messages. Just provide the raw JSON payload as you would send to Discord\'s API.',
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

export function buildCompleteStep(setupId: string, state: TSetupState, webhookUrl: string, maskedToken: string): RESTPostAPIChannelMessageJSONBody {
    const configSummary = [
        `**Type:** ${state.entity_type === 'bot' ? 'Bot' : 'Server'}`,
        `**Entity ID:** ${state.entity_id}`,
        state.channel_id ? `**Logging Channel:** <#${state.channel_id}>` : '**Logging Channel:** Not set',
        state.external_webhook_url ? `**External Webhook:** Set` : '**External Webhook:** Not set',
        state.rewards.length > 0 ? `**Reward Roles:** ${state.rewards.length}` : '**Reward Roles:** None',
        state.messages.length > 0 ? `**Messages:** ${state.messages.length} configured` : '**Messages:** Defaults',
    ].join('\n');

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
                content: '## Webhook URL',
            },
            {
                type: ComponentType.Container,
                accent_color: 5763719,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `Use this URL in your bot/server voting platform:\n\`\`\`\n${webhookUrl}\n\`\`\`\nAuth Token: ||${maskedToken}||`,
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
