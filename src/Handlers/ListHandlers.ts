import {Context} from "@Utils/Context";
import {
    APIComponentInContainer, APIComponentInMessageActionRow,
    ButtonStyle,
    ComponentType,
    MessageFlags,
    RESTPostAPIChannelMessageJSONBody,
} from "discord-api-types/v10";
import {
    checkForDuplicateEntityId,
    createEditState, deleteSetupState,
    getSetupState,
    type TSetupState,
    updateSetupState
} from "@Utils/SetupManager";
import {
    buildChannelAndWebhookStep, buildCompleteStep,
    buildEntityIdStep, buildEntitySelectionStep,
    buildMessagesStep,
    buildRewardsStep,
} from "@Utils/SetupComponents";
import {errorComponent, successComponent} from "@Utils/Components";
import SettingsModel from "@Schemas/Settings";
import {BrightImages} from "@Utils/BrightImages";

function buildPayload(components: RESTPostAPIChannelMessageJSONBody, flags?: number) {
    return {
        ...components,
        flags: flags || (MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral),
    };
}

export async function handleListEdit(ctx: Context, setupId: string) {
    const editSessionId = await createEditState(setupId, ctx.user.id);
    if (!editSessionId) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Failed to load setup. It may have been deleted.'));
    }

    const state = await getSetupState(editSessionId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Failed to initialize edit session.'));
    }

    await updateSetupState(editSessionId, {current_step: 2});

    return ctx.update(buildPayload(buildChannelAndWebhookStep(editSessionId, state)));
}

export async function refreshCurrentStep(ctx: Context, setupId: string, state: TSetupState) {
    const step = state.current_step;

    if (step === 0) {
        const hasServerEntity = await checkForDuplicateEntityId(ctx.interaction.guild_id!);

        return ctx.update(buildPayload(buildEntitySelectionStep(setupId, hasServerEntity)));
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
        return ctx.update(buildPayload(buildCompleteStep(setupId, state)));
    }

    return ctx.reply(errorComponent('Votes - Setup Wizard', 'Invalid step.'));
}

export async function handleListDump(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Edit session expired. Please start over.'));
    }

    const jsonData = {
        entity_type: state.entity_type,
        entity_id: state.entity_id,
        channel_id: state.channel_id,
        external_webhook_url: state.external_webhook_url,
        messages: state.messages,
        rewards: state.rewards,
        exported_at: new Date().toISOString(),
    };

    const fileName = `votes-backup-${state.entity_type}-${state.entity_id}-${Date.now()}.json`;
    const fileContent = Buffer.from(JSON.stringify(jsonData, null, 2), 'utf-8');

    return ctx.reply({
        content: 'Here is your configuration backup:',
        files: [{name: fileName, data: fileContent}],
        flags: MessageFlags.Ephemeral,
    });
}

export async function handleListDelete(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Edit session expired. Please start over.'));
    }

    if (!state.editing_id) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Cannot delete: This is a new setup, not an existing one.'));
    }

    const configSummary = [
        `**Configuration for:** ${state.entity_type === 'bot' ? `<@${state.entity_id}>` : (state.entity_type === 'server' ? `this server` : `Roblox Game ${state.entity_id}`)}`,
        state.channel_id ? `**Logging Channel:** <#${state.channel_id}>` : '**Logging Channel:** Not set',
        state.external_webhook_url ? `**External Webhook:** Set` : '**External Webhook:** Not set',
        state.rewards.length > 0 ? `**Reward Roles:** ${state.rewards.length}` : '**Reward Roles:** None',
        state.messages.length > 0 ? `**Messages:** ${state.messages.length} configured` : '**Messages:** Defaults',
    ].join('\n');

    return ctx.update(buildPayload({
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
                                content: '### Votes - Setup Wizard\n-# Delete Setup ⚠️'
                            },
                            {
                                type: ComponentType.TextDisplay,
                                content: `**Are you sure?**\n\nYou are about to delete the vote tracking setup for:\n${configSummary}\n\nThis action **cannot be undone**. All configuration including rewards, messages, and webhook settings will be permanently lost.`
                            }
                        ]
                    },
                    {
                        type: ComponentType.TextDisplay,
                        content: '> 💡 Consider using "Dump Settings" to backup your configuration before deleting.',
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
                                label: 'Yes, Delete It',
                                custom_id: `list_delete_confirm_${setupId}`,
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Secondary,
                                label: 'Dump Settings',
                                custom_id: `list_dump_${setupId}`,
                            },
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Secondary,
                                label: 'Cancel',
                                custom_id: `list_delete_cancel_${setupId}`,
                            },
                        ],
                    },
                ]
            },
        ],
    }));
}

export async function handleListDeleteConfirm(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Edit session expired. Please start over.'));
    }

    if (!state.editing_id) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Cannot delete: This is a new setup, not an existing one.'));
    }

    await SettingsModel.deleteOne({_id: state.editing_id});

    await deleteSetupState(setupId);

    return ctx.update(successComponent('Votes - Setup Wizard', 'The vote tracking setup has been permanently deleted.\n-# Use `/list` to view your remaining setups or `/setup` to create a new one.'));
}

export async function handleListDeleteCancel(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Edit session expired. Please start over.'));
    }

    return refreshCurrentStep(ctx, setupId, state);
}

export async function handleListToggleEnable(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Edit session expired. Please start over.'));
    }

    const updated = await updateSetupState(setupId, {disable: false});
    if (!updated) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Edit session expired. Please start over.'));
    }

    return refreshCurrentStep(ctx, setupId, updated);
}

export async function handleListToggleDisable(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Edit session expired. Please start over.'));
    }

    const updated = await updateSetupState(setupId, {disable: true});
    if (!updated) {
        return ctx.reply(errorComponent('Votes - Setup Wizard', 'Edit session expired. Please start over.'));
    }

    return refreshCurrentStep(ctx, setupId, updated);
}
