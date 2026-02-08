import {Context} from "@Utils/Context";
import {
    APIMessageComponentGuildInteraction,
    ComponentType,
    MessageFlags,
    Routes,
    APIMessageRoleSelectInteractionData,
    APIMessageChannelSelectInteractionData,
    RESTPostAPIChannelMessageJSONBody,
} from "discord-api-types/v10";
import {DiscordClient} from "@API/DiscordClient";
import {
    getSetupState,
    updateSetupState,
    deleteSetupState,
    previousStep,
    nextStep,
    generateAuthToken,
    saveSetupToDatabase,
    countSetupsForServer,
    type TSetupState
} from "@Utils/SetupManager";
import {
    buildEntityIdStep,
    buildChannelAndWebhookStep,
    buildMessagesStep,
    buildRewardsStep,
    buildCompleteStep,
    buildEntityIdModal,
    buildExternalWebhookModal,
    buildFirstVoteMessageModal,
    buildVoteMessageModal,
    buildAddRewardModal,
} from "@Utils/SetupComponents";
import Redis from "@API/RedisCache";

function buildPayload(components: RESTPostAPIChannelMessageJSONBody, flags?: number) {
    return {
        ...components,
        flags: flags || (MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral),
    };
}

export async function handleSetupBot(ctx: Context, setupId: string) {
    const state = await updateSetupState(setupId, {entity_type: 'bot'});
    if (!state) {
        return ctx.reply({content: 'Setup session expired. Please start over.'});
    }

    return ctx.update(buildPayload(buildEntityIdStep(setupId, 'bot')));
}

export async function handleSetupServer(ctx: Context, setupId: string) {
    const state = await updateSetupState(setupId, {entity_type: 'server'});
    if (!state) {
        return ctx.reply({content: 'Setup session expired. Please start over.'});
    }

    return ctx.update(buildPayload(buildEntityIdStep(setupId, 'server')));
}

export async function handleSetupCancel(ctx: Context, setupId: string) {
    await deleteSetupState(setupId);

    return ctx.update(buildPayload({
        components: [
            {
                type: ComponentType.TextDisplay,
                content: '# Setup Cancelled',
            },
            {
                type: ComponentType.TextDisplay,
                content: 'The setup has been cancelled. No changes have been saved.',
            },
        ],
    }));
}

export async function handleSetupBack(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply({content: 'Setup session expired. Please start over.'});
    }

    if (state.current_step === 0) {
        return ctx.update({
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
                            style: 1,
                            label: 'Bot',
                            custom_id: `setup_bot_${setupId}`,
                        },
                        {
                            type: ComponentType.Button,
                            style: 1,
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
                            style: 4,
                            label: 'Cancel',
                            custom_id: `setup_cancel_${setupId}`,
                        },
                    ],
                },
            ],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral,
        });
    }

    const previous = await previousStep(setupId);
    if (!previous) {
        return ctx.reply({content: 'Cannot go back further.'});
    }

    return refreshCurrentStep(ctx, setupId, previous);
}

export async function handleSetupNext(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply({content: 'Setup session expired. Please start over.'});
    }

    if (state.current_step === 2 && !state.entity_id) {
        return ctx.reply({content: 'Please enter an entity ID first.'});
    }

    if (state.current_step === 4) {
        const authToken = await generateAuthToken();
        const updated = await updateSetupState(setupId, {auth_token: authToken});
        if (!updated) {
            return ctx.reply({content: 'Setup session expired.'});
        }

        const webhookUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/webhook/vote`;
        const maskedToken = authToken.substring(0, 8) + '...' + authToken.substring(authToken.length - 4);

        return ctx.update({
            ...buildCompleteStep(setupId, updated, webhookUrl, maskedToken),
            flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral,
        });
    }

    const next = await nextStep(setupId);
    if (!next) {
        return ctx.reply({content: 'Cannot proceed further.'});
    }

    return refreshCurrentStep(ctx, setupId, next);
}

export async function handleSetupEnterEntityId(ctx: Context, setupId: string) {
    return ctx.showModal(buildEntityIdModal(setupId));
}

export async function handleSetupChannelSelect(ctx: Context, setupId: string) {
    if (!ctx.isComponent()) {
        return ctx.reply({content: 'Invalid interaction type.'});
    }

    const interactionData = ctx.interaction.data as APIMessageChannelSelectInteractionData;
    const selectedChannelId = interactionData.values?.[0];
    if (!selectedChannelId) {
        return ctx.reply({content: 'No channel selected.'});
    }

    const state = await updateSetupState(setupId, {channel_id: selectedChannelId});
    if (!state) {
        return ctx.reply({content: 'Setup session expired. Please start over.'});
    }

    return ctx.update(buildPayload(buildChannelAndWebhookStep(setupId, state)));
}

export async function handleSetupEnterWebhook(ctx: Context, setupId: string) {
    return ctx.showModal(buildExternalWebhookModal(setupId));
}

export async function handleSetupTestChannel(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state || !state.channel_id) {
        return ctx.reply({content: 'No channel set to test.'});
    }

    const cooldown = await Redis.getInstance().get('vote-tracker:test:cooldown:' + state.channel_id);
    if (cooldown) {
        return ctx.reply({content: 'Test message already sent in the last 2 minutes. Please wait for 2 minutes before sending another test message.'});
    }

    await Redis.getInstance().set('vote-tracker:test:cooldown:' + state.channel_id, true, 2 * 60)

    try {
        await DiscordClient.getInstance().rest.post(Routes.channelMessages(state.channel_id), {
            body: {
                content: '🎉 Test message from Vote Tracker!\n\nThis is a test message to verify that the logging channel is working correctly.',
            },
        });

        return ctx.reply({
            content: '✅ Test message sent successfully! Check the channel.',
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        return ctx.reply({
            content: '❌ Failed to send test message. Please check bot permissions.',
            flags: MessageFlags.Ephemeral
        });
    }
}

export async function handleSetupEditFirstVote(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply({content: 'Setup session expired. Please start over.'});
    }

    const existingMessage = state.messages.find(m => m.type === 'first-vote');

    return ctx.showModal(buildFirstVoteMessageModal(setupId, existingMessage?.payload || ''));
}

export async function handleSetupEditVote(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply({content: 'Setup session expired. Please start over.'});
    }

    const existingMessage = state.messages.find(m => m.type === 'vote');

    return ctx.showModal(buildVoteMessageModal(setupId, existingMessage?.payload || ''));
}

export async function handleSetupAddReward(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply({content: 'Setup session expired. Please start over.'});
    }

    if (state.rewards.length >= 25) {
        return ctx.reply({content: 'Maximum of 25 reward roles reached.'});
    }

    return ctx.showModal(buildAddRewardModal(setupId));
}

export async function handleSetupRemoveReward(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply({content: 'Setup session expired. Please start over.'});
    }

    if (state.rewards.length === 0) {
        return ctx.reply({content: 'No rewards to remove.'});
    }

    const updated = await updateSetupState(setupId, {
        rewards: state.rewards.slice(0, -1),
    });
    if (!updated) {
        return ctx.reply({content: 'Setup session expired.'});
    }

    return ctx.update(buildPayload(buildRewardsStep(setupId, updated)));
}

export async function handleSetupFinish(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply({content: 'Setup session expired. Please start over.'});
    }

    const existingCount = await countSetupsForServer(state.server_id);
    if (existingCount >= 25) {
        return ctx.reply({content: '❌ Maximum of 25 setups per server reached. Please delete an existing setup first.'});
    }

    const success = await saveSetupToDatabase(setupId);
    if (!success) {
        return ctx.reply({content: '❌ Failed to save setup. Please try again.'});
    }

    return ctx.update(buildPayload({
        components: [
            {
                type: ComponentType.TextDisplay,
                content: '# ✅ Setup Complete!',
            },
            {
                type: ComponentType.TextDisplay,
                content: 'Your vote tracking setup has been saved successfully!',
            },
            {
                type: ComponentType.TextDisplay,
                content: 'You can now use the webhook URL provided in the previous step to receive vote notifications.',
            },
        ],
    }));
}

export async function handleSetupEntityIdModal(ctx: Context, setupId: string, entityId: string) {
    if (!entityId || entityId.trim().length === 0) {
        return ctx.reply({content: 'Entity ID cannot be empty.'});
    }

    const state = await updateSetupState(setupId, {entity_id: entityId.trim()});
    if (!state) {
        return ctx.reply({content: 'Setup session expired. Please start over.'});
    }

    return ctx.update({
        ...buildChannelAndWebhookStep(setupId, state),
        flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral,
    });
}

export async function handleSetupWebhookModal(ctx: Context, setupId: string, webhookUrl: string) {
    if (webhookUrl && webhookUrl.trim().length > 0) {
        try {
            new URL(webhookUrl.trim());
        } catch {
            return ctx.reply({content: 'Invalid webhook URL format.'});
        }
    }

    const state = await updateSetupState(setupId, {
        external_webhook_url: webhookUrl.trim() || null,
    });
    if (!state) {
        return ctx.reply({content: 'Setup session expired. Please start over.'});
    }

    return ctx.update({
        ...buildChannelAndWebhookStep(setupId, state),
        flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral,
    });
}

export async function handleSetupFirstVoteModal(ctx: Context, setupId: string, message: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply({content: 'Setup session expired. Please start over.'});
    }

    const updatedMessages = state.messages.filter(m => m.type !== 'first-vote');
    if (message && message.trim().length > 0) {
        updatedMessages.push({
            type: 'first-vote',
            payload: message.trim(),
        });
    }

    const updated = await updateSetupState(setupId, {messages: updatedMessages});
    if (!updated) {
        return ctx.reply({content: 'Setup session expired.'});
    }

    return ctx.update(buildPayload(buildMessagesStep(setupId, updated)));
}

export async function handleSetupVoteModal(ctx: Context, setupId: string, message: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply({content: 'Setup session expired. Please start over.'});
    }

    const updatedMessages = state.messages.filter(m => m.type !== 'vote');
    if (message && message.trim().length > 0) {
        updatedMessages.push({
            type: 'vote',
            payload: message.trim(),
        });
    }

    const updated = await updateSetupState(setupId, {messages: updatedMessages});
    if (!updated) {
        return ctx.reply({content: 'Setup session expired.'});
    }

    return ctx.update(buildPayload(buildMessagesStep(setupId, updated)));
}

export async function handleSetupAddRewardModal(ctx: Context, setupId: string, roleId: string, minVotes: string, durationMin: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply({content: 'Setup session expired. Please start over.'});
    }

    if (!roleId) {
        return ctx.reply({content: 'No role selected. Please try again.'});
    }

    if (state.rewards.length >= 25) {
        return ctx.reply({content: 'Maximum of 25 reward roles reached.'});
    }

    const minVotesNum = minVotes && minVotes.trim().length > 0 ? parseInt(minVotes) : 0;
    const durationMinNum = durationMin && durationMin.trim().length > 0 ? parseInt(durationMin) : 0;

    if (isNaN(minVotesNum) || minVotesNum < 0) {
        return ctx.reply({content: 'Invalid minimum votes value.'});
    }

    if (isNaN(durationMinNum) || durationMinNum < 0) {
        return ctx.reply({content: 'Invalid duration value.'});
    }

    const updated = await updateSetupState(setupId, {
        rewards: [
            ...state.rewards,
            {
                role_id: roleId,
                min_votes: minVotesNum,
                duration_min: durationMinNum,
            },
        ],
    });
    if (!updated) {
        return ctx.reply({content: 'Setup session expired.'});
    }

    return ctx.update(buildPayload(buildRewardsStep(setupId, updated)));
}

async function refreshCurrentStep(ctx: Context, setupId: string, state: TSetupState) {
    const step = state.current_step;

    if (step === 0) {
        return ctx.update(buildPayload({
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
                            style: 1,
                            label: 'Bot',
                            custom_id: `setup_bot_${setupId}`,
                        },
                        {
                            type: ComponentType.Button,
                            style: 1,
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
                            style: 4,
                            label: 'Cancel',
                            custom_id: `setup_cancel_${setupId}`,
                        },
                    ],
                },
            ],
        }));
    }

    if (step === 1) {
        return ctx.update(buildPayload(buildEntityIdStep(setupId, state.entity_type || 'bot')));
    }

    if (step === 2) {
        return ctx.update(buildPayload(buildChannelAndWebhookStep(setupId, state)));
    }

    if (step === 3) {
        return ctx.update(buildPayload(buildMessagesStep(setupId, state)));
    }

    if (step === 4) {
        return ctx.update(buildPayload(buildRewardsStep(setupId, state)));
    }

    if (step === 5) {
        const webhookUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/webhook/vote`;
        const maskedToken = state.auth_token ? state.auth_token.substring(0, 8) + '...' + state.auth_token.substring(state.auth_token.length - 4) : '...';

        return ctx.update(buildPayload(buildCompleteStep(setupId, state, webhookUrl, maskedToken)));
    }

    return ctx.reply({content: 'Invalid step.'});
}
