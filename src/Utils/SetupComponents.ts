import {ComponentType, ButtonStyle, APIModalInteractionResponseCallbackData, RESTPostAPIChannelMessageJSONBody, APIMessageComponent, APIMessageTopLevelComponent} from "discord-api-types/v10";
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
    return {
        components: [
            {
                type: ComponentType.TextDisplay,
                content: `# Setup Vote Tracking - Step 2/6`,
            },
            {
                type: ComponentType.TextDisplay,
                content: `Enter the ${entityType} ID you want to track votes for.`,
            },
            {
                type: ComponentType.TextDisplay,
                content: '> 💡 You can find this in the URL of your bot/server page on the voting platform.',
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
        title: 'Enter Entity ID',
        custom_id: `setup_modal_entityid_${setupId}`,
        components: [
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.TextInput,
                        style: 1,
                        custom_id: 'entity_id',
                        label: 'Entity ID',
                        placeholder: 'Enter the bot or server ID...',
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

    return {
        components: [
            {
                type: ComponentType.TextDisplay,
                content: '# Setup Vote Tracking - Step 3/6',
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
                ],
            },
        ],
    };
}

export function buildExternalWebhookModal(setupId: string): APIModalInteractionResponseCallbackData {
    return {
        title: 'External Webhook URL',
        custom_id: `setup_modal_webhook_${setupId}`,
        components: [
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.TextInput,
                        style: 1,
                        custom_id: 'webhook_url',
                        label: 'Webhook URL',
                        placeholder: 'https://your-webhook-url.com',
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

    const firstVoteStatus = firstVoteMessage ? '✅ Configured' : 'Configure';
    const voteStatus = voteMessage ? '✅ Configured' : 'Configure';

    return {
        components: [
            {
                type: ComponentType.TextDisplay,
                content: '# Setup Vote Tracking - Step 4/6',
            },
            {
                type: ComponentType.TextDisplay,
                content: 'Configure the messages sent when users vote.',
            },
            {
                type: ComponentType.TextDisplay,
                content: '> 💡 Messages use Discord markdown. Available variables: {user}, {votes}',
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
                ],
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
                        label: 'Message Content',
                        placeholder: 'Thanks {user} for your first vote! 🎉',
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
                        label: 'Message Content',
                        placeholder: '{user} has voted! Total votes: {votes}',
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

    const components: APIMessageTopLevelComponent[] = [
        {
            type: ComponentType.TextDisplay,
            content: '# Setup Vote Tracking - Step 5/6',
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
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Danger,
                    label: 'Remove Last Role',
                    custom_id: `setup_remove_reward_${setupId}`,
                    disabled: rewardsCount === 0,
                },
            ],
        },
    ];

    if (rewardsCount > 0) {
        components.push({
            type: ComponentType.Container,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `## Current Rewards (${rewardsCount})`,
                },
                {
                    type: ComponentType.TextDisplay,
                    content: state.rewards.map((r, i) => `${i + 1}. <@&${r.role_id}>${r.min_votes > 0 ? ` (min ${r.min_votes} votes)` : ''}`).join('\n'),
                },
            ],
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
        ],
    });

    return {components};
}

export function buildAddRewardModal(setupId: string): APIModalInteractionResponseCallbackData {
    return {
        title: 'Add Reward Role',
        custom_id: `setup_modal_addreward_${setupId}`,
        components: [
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.RoleSelect,
                        custom_id: 'role_id',
                        placeholder: 'Select a role to reward',
                        min_values: 1,
                        max_values: 1,
                    } as any,
                ],
            },
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.TextInput,
                        style: 1,
                        custom_id: 'min_votes',
                        label: 'Minimum Votes Required',
                        placeholder: 'Leave empty for no minimum',
                        required: false,
                        max_length: 10,
                    },
                ],
            },
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.TextInput,
                        style: 1,
                        custom_id: 'duration_min',
                        label: 'Duration in Minutes (optional)',
                        placeholder: 'Leave empty for permanent',
                        required: false,
                        max_length: 10,
                    },
                ],
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
        state.messages.length > 0 ? `**Messages:** ${state.messages.length} configured` : '**Messages:** Not configured',
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
