import {Context} from "@Utils/Context";
import {
    APIMessageChannelSelectInteractionData, APIModalSubmitInteraction, APIUserInteractionDataResolved,
    ComponentType,
    MessageFlags, RESTGetAPIChannelMessageResult,
    RESTPostAPIChannelMessageJSONBody,
    Routes,
} from "discord-api-types/v10";
import {DiscordClient} from "@API/DiscordClient";
import {
    checkForDuplicateEntityId,
    countSetupsForServer, defaultFirstVote, defaultVote,
    deleteSetupState,
    getSetupState,
    nextStep,
    previousStep,
    saveSetupToDatabase,
    type TSetupState,
    updateSetupState
} from "@Utils/SetupManager";
import {
    buildAddRewardModal,
    buildChannelAndWebhookStep,
    buildCompleteStep,
    buildEntityIdModal,
    buildEntityIdStep,
    buildEntitySelectionStep,
    buildExternalWebhookModal,
    buildFirstVoteMessageModal,
    buildMessagesStep,
    buildPlatformDiscordBotListGuide,
    buildPlatformDiscordsComGuide,
    buildPlatformTopGGGuide,
    buildRewardsStep,
    buildVoteMessageModal,
} from "@Utils/SetupComponents";
import Redis from "@API/RedisCache";
import TopggConnectionModel from "@Schemas/Integrations/Topgg";
import {generateKey} from "@Utils/Key";
import {refreshCurrentStep as listRefreshCurrentStep} from "@Handlers/ListHandlers";
import {errorComponent, infoComponent, successComponent} from "@Utils/Components";
import {delay} from "bullmq";
import {blockedHostnames} from "@Utils/Http";

function buildPayload(components: RESTPostAPIChannelMessageJSONBody, flags?: number) {
    return {
        ...components,
        flags: flags || (MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral),
    };
}

export async function handleSetupBot(ctx: Context, setupId: string) {
    const state = await updateSetupState(setupId, {
        entity_type: 'bot',
        entity_id: null,
        current_step: 1,
    });
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    return ctx.update(buildPayload(buildEntityIdStep(setupId, 'bot')));
}

export async function handleSetupServer(ctx: Context, setupId: string) {
    const serverId = ctx.interaction.guild_id;
    if (!serverId) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'This command can only be used in a server.'));
    }

    const existingEntity = await checkForDuplicateEntityId(serverId);
    if (existingEntity) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'An entity with the same ID already exists. Please select a different ID.'));
    }

    const state = await updateSetupState(setupId, {entity_type: 'server', entity_id: serverId, current_step: 2});
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    return ctx.update(buildPayload(buildChannelAndWebhookStep(setupId, state)));
}

export async function handleSetupGame(ctx: Context, setupId: string) {
    const state = await updateSetupState(setupId, {entity_type: 'game', current_step: 1});
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    return ctx.update(buildPayload(buildEntityIdStep(setupId, 'game')));
}

export async function handleSetupCancel(ctx: Context, setupId: string) {
    await deleteSetupState(setupId);

    return ctx.update(successComponent('Votes - Setup Wizard', 'The setup has been cancelled. No changes have been saved.'));
}

export async function handleSetupBack(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    if (state.editing_id && state.current_step <= 2) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Cannot go back further. The entity type and ID are already set.'));
    }

    if (state.current_step === 0) {
        const hasServerEntity = await checkForDuplicateEntityId(ctx.interaction.guild_id!);

        return ctx.update(buildPayload(buildEntitySelectionStep(setupId, hasServerEntity)));
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
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    if (!state.entity_id) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Please enter your bot or server ID first.'));
    }

    if (state.current_step === 2 && state.channel_id) {
        const cooldown = await Redis.getInstance().get('discord:vt:test:cooldown:' + state.channel_id);
        if (!cooldown) {
            await Redis.getInstance().set('discord:vt:test:cooldown:' + state.channel_id, true, 2 * 60)

            try {
                const message = await DiscordClient.getInstance().rest.post(Routes.channelMessages(state.channel_id), {
                    body: infoComponent('Votes - Setup Wizard', 'If you see this message, the test was successful!'),
                }) as RESTGetAPIChannelMessageResult;

                if (message && message.id) {
                    try {
                        await delay(1000);

                        await DiscordClient.getInstance().rest.delete(Routes.channelMessage(state.channel_id, message.id));
                    } catch (e) {

                    }
                }
            } catch (error) {
                return ctx.reply(errorComponent('Votes - Setup Wizard', 'Failed to send test message. Please check bot permissions before you continue.'));
            }
        }
    }

    if (state.current_step === 4) {
        if (state.editing_id) {
            const next = await nextStep(setupId);
            if (!next) {
                return ctx.reply(errorComponent('Votes - Setup Wizard', 'Cannot proceed further.'));
            }

            return listRefreshCurrentStep(ctx, setupId, next);
        }

        const authToken = generateKey();
        const updated = await updateSetupState(setupId, {auth_token: authToken, current_step: state.current_step + 1});
        if (!updated) {
            return ctx.reply(errorComponent('Votes - Setup Wizard', 'Updating the session failed. Please start a new setup.'));
        }

        return ctx.update(buildPayload(buildCompleteStep(setupId, updated)));
    }

    const next = await nextStep(setupId);
    if (!next) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Cannot proceed further.'));
    }

    return refreshCurrentStep(ctx, setupId, next);
}

export async function handleSetupEnterEntityId(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    const entityType = state.entity_type || 'bot';
    return ctx.showModal(buildEntityIdModal(setupId, entityType as 'bot' | 'server' | 'game'));
}

export async function handleSetupUsePreFetchedId(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    if (!state.entity_id) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'No pre-fetched ID found. Please enter an ID manually.'));
    }

    const updated = await updateSetupState(setupId, {current_step: 2});
    if (!updated) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Updating the session failed. Please start a new setup.'));
    }

    return ctx.update(buildPayload(buildChannelAndWebhookStep(setupId, updated)));
}

export async function handleSetupChannelSelect(ctx: Context, setupId: string) {
    const interactionData = ctx.interaction.data as APIMessageChannelSelectInteractionData;
    let selectedChannelId: Nullable<string> = interactionData.values?.[0];
    if (!selectedChannelId) {
        selectedChannelId = null;
    }

    const state = await updateSetupState(setupId, {channel_id: selectedChannelId});
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    return ctx.update(buildPayload(buildChannelAndWebhookStep(setupId, state)));
}

export async function handleSetupEnterWebhook(ctx: Context, setupId: string) {
    return ctx.showModal(buildExternalWebhookModal(setupId));
}

export async function handleSetupTestChannel(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state || !state.channel_id) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Please select a channel to continue.'));
    }

    const cooldown = await Redis.getInstance().get('discord:vt:test:cooldown:' + state.channel_id);
    if (cooldown) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Test message already sent in the last 2 minutes. Please wait for 2 minutes before sending another test message.'));
    }

    await Redis.getInstance().set('discord:vt:test:cooldown:' + state.channel_id, true, 2 * 60)

    try {
        await DiscordClient.getInstance().rest.post(Routes.channelMessages(state.channel_id), {
            body: infoComponent('Votes - Setup Wizard', 'If you see this message, the test was successful!'),
        });

        return ctx.reply(successComponent('Votes - Setup Wizard', 'Sent the test message successfully.'));
    } catch (error) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Failed to send test message. Please check bot permissions.'));
    }
}

export async function handleSetupViewFirstVote(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    const existingMessage = state.messages.find(m => m.type === 'first-vote');

    return ctx.reply(infoComponent('Votes - Setup Wizard\n-# Messages', 'Current First Vote Message:\n```\n' + (existingMessage?.payload || defaultFirstVote) + '\n```'));
}

export async function handleSetupViewVote(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    const existingMessage = state.messages.find(m => m.type === 'vote');

    return ctx.reply(infoComponent('Votes - Setup Wizard\n-# Messages', 'Current Vote Message:\n```\n' + (existingMessage?.payload || defaultVote) + '\n```'));
}

export async function handleSetupEditFirstVote(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    const existingMessage = state.messages.find(m => m.type === 'first-vote');

    return ctx.showModal(buildFirstVoteMessageModal(setupId, existingMessage?.payload || ''));
}

export async function handleSetupEditVote(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    const existingMessage = state.messages.find(m => m.type === 'vote');

    return ctx.showModal(buildVoteMessageModal(setupId, existingMessage?.payload || ''));
}

export async function handleSetupAddReward(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    if (state.rewards.length >= 25) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Maximum of 25 reward roles reached.'));
    }

    return ctx.showModal(buildAddRewardModal(setupId));
}

export async function handleSetupRemoveReward(ctx: Context, setupId: string, rewardIndex: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    const index = parseInt(rewardIndex);
    if (isNaN(index) || index < 0 || index >= state.rewards.length) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Invalid reward, please try again or contact the support.'));
    }

    const updated = await updateSetupState(setupId, {
        rewards: state.rewards.filter((_, i) => i !== index),
    });
    if (!updated) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Updating the session failed. Please start a new setup.'));
    }

    return ctx.update(buildPayload(buildRewardsStep(setupId, updated)));
}

export async function handleSetupFinish(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    if (state.editing_id) {
        const result = await saveSetupToDatabase(setupId);
        if (!result.success) {
            if (result.error) {
                return ctx.reply(errorComponent('Votes - Setup Wizard', result.error));
            }

            return ctx.reply(errorComponent('Votes - Setup Wizard', 'Failed to update setup. Please try again.'));
        }

        const wasDisabled = state.disable;
        const isEnabledNow = !wasDisabled;

        return ctx.update(successComponent(
            'Votes - Setup Wizard\n-# ' + (wasDisabled && isEnabledNow ? 'Setup Enabled!' : 'Changes Saved!'),
            wasDisabled && isEnabledNow
                ? 'Your vote tracking setup has been enabled successfully and is now active!'
                : 'Your vote tracking setup has been updated successfully!'
        ));
    }

    const existingCount = await countSetupsForServer(state.server_id);
    if (existingCount >= 25) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Maximum of 25 setups per server reached. Please delete an existing setup first.'));
    }

    const result = await saveSetupToDatabase(setupId);
    if (!result.success) {
        if (result.error) {
            return ctx.reply(errorComponent('Votes - Setup Wizard', result.error));
        }

        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Failed to save setup. Please try again.'));
    }

    return ctx.update(successComponent(
        'Votes - Setup Wizard\n-# Setup Complete!',
        'Your vote tracking setup has been saved successfully!'
    ));
}

export async function handleSetupEntityIdModal(ctx: Context, setupId: string, entityId: string) {
    if (!entityId || entityId.trim().length === 0) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'The ID cannot be empty.'));
    }

    const resolved = (ctx.interaction.data as APIModalSubmitInteraction['data']).resolved;
    if (resolved && resolved.users && !resolved.users[entityId].bot) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'The selected user is not a bot. Please select a bot instead.'));
    }

    const existingEntity = await checkForDuplicateEntityId(entityId);
    if (existingEntity) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'An entity with the same ID already exists. Please select a different ID.'));
    }

    const state = await updateSetupState(setupId, {entity_id: entityId.trim(), current_step: 2});
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    return ctx.update(buildPayload(buildChannelAndWebhookStep(setupId, state)));
}

export async function handleSetupWebhookModal(ctx: Context, setupId: string, webhookUrl: string) {
    if (webhookUrl && webhookUrl.trim().length > 0) {
        try {
            const url = new URL(webhookUrl.trim());

            if (url.protocol !== 'https:') {
                return ctx.reply(errorComponent('Votes - Setup Wizard', 'Webhook URL must use https.'));
            }

            const blockedHostname = blockedHostnames.find(hostname => url.hostname.includes(hostname));
            if (blockedHostname) {
                return ctx.reply(errorComponent('Votes - Setup Wizard', 'Webhook URL cannot use a blocked hostname. (' + blockedHostname + ')'));
            }
        } catch {
            return ctx.reply(errorComponent('Votes - Setup Wizard', 'Invalid webhook URL format.'));
        }
    }

    const state = await updateSetupState(setupId, {
        external_webhook_url: webhookUrl.trim() || null,
    });
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    return ctx.update(buildPayload(buildChannelAndWebhookStep(setupId, state)));
}

export async function handleSetupFirstVoteModal(ctx: Context, setupId: string, message: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    const payload = message.trim();
    const updatedMessages = state.messages.filter(m => m.type !== 'first-vote');
    if (payload.length > 0) {
        updatedMessages.push({
            type: 'first-vote',
            payload: payload,
        });
    }

    const updated = await updateSetupState(setupId, {messages: updatedMessages});
    if (!updated) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Updating the session failed. Please start a new setup.'));
    }

    return ctx.update(buildPayload(buildMessagesStep(setupId, updated)));
}

export async function handleSetupVoteModal(ctx: Context, setupId: string, message: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    const payload = message.trim();
    const updatedMessages = state.messages.filter(m => m.type !== 'vote');
    if (payload.length > 0) {
        updatedMessages.push({
            type: 'vote',
            payload: payload,
        });
    }

    const updated = await updateSetupState(setupId, {messages: updatedMessages});
    if (!updated) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Updating the session failed. Please start a new setup.'));
    }

    return ctx.update(buildPayload(buildMessagesStep(setupId, updated)));
}

export async function handleSetupAddRewardModal(ctx: Context, setupId: string, roleId: string, minVotes: string, durationMin: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    if (!roleId) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'No role selected. Please try again.'));
    }

    if (state.rewards.length >= 25) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Maximum of 25 reward roles reached.'));
    }

    const minVotesNum = minVotes && minVotes.trim().length > 0 ? parseInt(minVotes) : 0;
    const durationMinNum = durationMin && durationMin.trim().length > 0 ? parseInt(durationMin) : 0;

    if (isNaN(minVotesNum) || minVotesNum < 0) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Invalid minimum votes value.'));
    }

    if (isNaN(durationMinNum) || durationMinNum < 0) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Invalid duration value.'));
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
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Updating the session failed. Please start a new setup.'));
    }

    return ctx.update(buildPayload(buildRewardsStep(setupId, updated)));
}

async function refreshCurrentStep(ctx: Context, setupId: string, state: TSetupState) {
    const step = state.current_step;

    if (step === 0) {
        const hasServerEntity = await checkForDuplicateEntityId(ctx.interaction.guild_id!);

        return ctx.update(buildPayload(buildEntitySelectionStep(setupId, hasServerEntity)));
    }

    if (step === 1) {
        return ctx.update(buildPayload(buildEntityIdStep(setupId, state.entity_type!)));
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
        return ctx.update(buildPayload(buildCompleteStep(setupId, state)));
    }

    return ctx.reply({content: 'Invalid step.'});
}

export async function handleSetupPlatformTopGG(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    const webhookUrl = `https://votes.discordbots.xyz/webhooks/top-gg/${state.auth_token}`;
    const maskedToken = state.auth_token ? state.auth_token : '...';

    const existingConnection = await TopggConnectionModel.findOne({
        project_type: state.entity_type,
        project_platform_id: state.entity_id,
    });

    return ctx.update(buildPayload(buildPlatformTopGGGuide(setupId, state, webhookUrl, maskedToken, !!existingConnection)));
}

export async function handleSetupPlatformDiscordBotList(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    const webhookUrl = `https://votes.discordbots.xyz/webhooks/dbl/${state.auth_token}`;
    const maskedToken = state.auth_token ? state.auth_token : '...';

    return ctx.update(buildPayload(buildPlatformDiscordBotListGuide(setupId, state, webhookUrl, maskedToken)));
}

export async function handleSetupPlatformDiscordsCom(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    const webhookUrl = `https://votes.discordbots.xyz/webhooks/ds/${state.auth_token}`;
    const maskedToken = state.auth_token ? state.auth_token : '...';

    return ctx.update(buildPayload(buildPlatformDiscordsComGuide(setupId, state, webhookUrl, maskedToken)));
}

export async function handleSetupPlatformBack(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    return ctx.update(buildPayload(buildCompleteStep(setupId, state)));
}

export async function handleSetupSelectConnection(ctx: Context, setupId: string, selectedValue: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Setup session expired. Please start over.'));
    }

    if (selectedValue === 'decline') {
        const hasServerEntity = await checkForDuplicateEntityId(ctx.interaction.guild_id!);

        return ctx.update(buildPayload(buildEntitySelectionStep(setupId, hasServerEntity)));
    }

    const entityId = selectedValue.replace('conn_', '');

    const updated = await updateSetupState(setupId, {
        entity_type: 'bot',
        entity_id: entityId,
        current_step: 2,
    });
    if (!updated) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Updating the session failed. Please start a new setup.'));
    }

    return ctx.update(buildPayload(buildChannelAndWebhookStep(setupId, updated)));
}
