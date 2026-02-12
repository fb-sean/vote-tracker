import {Context} from "@Utils/Context";
import {ButtonStyle, ComponentType, MessageFlags, RESTPostAPIChannelMessageJSONBody,} from "discord-api-types/v10";
import {createEditState, getSetupState, type TSetupState, updateSetupState} from "@Utils/SetupManager";
import {
    buildChannelAndWebhookStep,
    buildEntityIdStep, buildEntitySelectionStep,
    buildMessagesStep,
    buildRewardsStep,
} from "@Utils/SetupComponents";

function buildPayload(components: RESTPostAPIChannelMessageJSONBody, flags?: number) {
    return {
        ...components,
        flags: flags || (MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral),
    };
}

export async function handleListEdit(ctx: Context, setupId: string) {
    const editSessionId = await createEditState(setupId, ctx.user.id);
    if (!editSessionId) {
        return ctx.reply({content: 'Failed to load setup. It may have been deleted.'});
    }

    const state = await getSetupState(editSessionId);
    if (!state) {
        return ctx.reply({content: 'Failed to initialize edit session.'});
    }

    await updateSetupState(editSessionId, {current_step: 2});

    return ctx.update(buildPayload(buildChannelAndWebhookStep(editSessionId, state)));
}

export async function refreshCurrentStep(ctx: Context, setupId: string, state: TSetupState) {
    const step = state.current_step;

    if (step === 0) {
        return ctx.update(buildPayload(buildEntitySelectionStep(setupId)));
    }

    if (step === 1) {
        return ctx.update(buildPayload(buildEntityIdStep(setupId, state.entity_type || 'bot', state.entity_id)));
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
        const isDisabled = state.disable;
        const statusText = isDisabled ? '🔴 **Status:** Disabled\n\nThis setup is currently disabled and will not track votes.' : '✅ **Status:** Enabled\n\nThis setup is active and tracking votes.';
        const statusColor = isDisabled ? 15548997 : 5763719; // Red for disabled, blue for enabled
        const entityType = state.entity_type || 'bot';
        const showDiscordBotList = entityType === 'bot' || entityType === 'game';

        const firstActionRow: any[] = [
            {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                label: 'Dump JSON',
                custom_id: `list_dump_${setupId}`,
            },
            {
                type: ComponentType.Button,
                style: ButtonStyle.Danger,
                label: 'Delete Setup',
                custom_id: `list_delete_${setupId}`,
            },
        ];

        if (isDisabled) {
            firstActionRow.splice(1, 0, {
                type: ComponentType.Button,
                style: ButtonStyle.Success,
                label: 'Enable Setup',
                custom_id: `list_toggle_enable_${setupId}`,
            });
        } else {
            firstActionRow.splice(1, 0, {
                type: ComponentType.Button,
                style: ButtonStyle.Danger,
                label: 'Disable Setup',
                custom_id: `list_toggle_disable_${setupId}`,
            });
        }

        const components: any[] = [
            {
                type: ComponentType.TextDisplay,
                content: '# Review Changes',
            },
            {
                type: ComponentType.Container,
                accent_color: statusColor,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `${statusText}\n\n**Type:** ${state.entity_type === 'bot' ? 'Bot' : state.entity_type === 'game' ? 'Game' : 'Server'}\n**Entity ID:** ${state.entity_id}\n${state.channel_id ? `**Logging Channel:** <#${state.channel_id}>\n` : ''}${state.external_webhook_url ? '**External Webhook:** Set\n' : ''}${state.rewards.length > 0 ? `**Reward Roles:** ${state.rewards.length}\n` : ''}${state.messages.length > 0 ? `**Messages:** ${state.messages.length} configured` : '**Messages:** Defaults'}`,
                    },
                ],
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
        ];

        if (!isDisabled) {
            components.push({
                type: ComponentType.TextDisplay,
                content: '## Platform Setup',
            });
            components.push({
                type: ComponentType.TextDisplay,
                content: 'Click on a platform below to view webhook setup instructions:',
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
                ],
            });
            components.push({
                type: ComponentType.Separator,
                spacing: 1,
            });
        }

        components.push({
            type: ComponentType.TextDisplay,
            content: isDisabled
                ? 'Click "Enable Setup" to activate this vote tracking. It will validate that no other active setup is using the same entity ID.'
                : 'Click "Save Changes" to update your setup. The webhook URL and auth token remain unchanged.',
        });
        components.push({
            type: ComponentType.ActionRow,
            components: firstActionRow,
        });
        components.push({
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.Button,
                    style: isDisabled ? ButtonStyle.Success : ButtonStyle.Primary,
                    label: isDisabled ? 'Enable & Save' : 'Save Changes',
                    custom_id: `setup_finish_${setupId}`,
                },
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Secondary,
                    label: 'Cancel',
                    custom_id: `setup_cancel_${setupId}`,
                },
            ],
        });

        return ctx.update(buildPayload({components}));
    }

    return ctx.reply({content: 'Invalid step.'});
}

export async function handleListDump(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply({content: 'Edit session expired. Please start over.'});
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

    const fileName = `vote-tracker-backup-${state.entity_type}-${state.entity_id}-${Date.now()}.json`;
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
        return ctx.reply({content: 'Edit session expired. Please start over.'});
    }

    if (!state.editing_id) {
        return ctx.reply({content: 'Cannot delete: this is a new setup, not an existing one.'});
    }

    return ctx.update(buildPayload({
        components: [
            {
                type: ComponentType.TextDisplay,
                content: '# ⚠️ Delete Setup',
            },
            {
                type: ComponentType.Container,
                accent_color: 15548997,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `## Are you sure?\n\nYou are about to delete the vote tracking setup for:\n**Type:** ${state.entity_type === 'bot' ? 'Bot' : 'Server'}\n**Entity ID:** ${state.entity_id}\n\nThis action **cannot be undone**. All configuration including rewards, messages, and webhook settings will be permanently lost.`,
                    },
                ],
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.TextDisplay,
                content: '> 💡 Consider using "Dump JSON" to backup your configuration before deleting.',
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
                        label: 'Dump JSON',
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
        ],
    }));
}

export async function handleListDeleteConfirm(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply({content: 'Edit session expired. Please start over.'});
    }

    if (!state.editing_id) {
        return ctx.reply({content: 'Cannot delete: this is a new setup, not an existing one.'});
    }

    const SettingsModel = (await import('@Schemas/Settings')).default;

    await SettingsModel.deleteOne({_id: state.editing_id});

    const {deleteSetupState} = await import('@Utils/SetupManager');
    await deleteSetupState(setupId);

    return ctx.update(buildPayload({
        components: [
            {
                type: ComponentType.TextDisplay,
                content: '# ✅ Setup Deleted',
            },
            {
                type: ComponentType.Container,
                accent_color: 5763719,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: 'The vote tracking setup has been permanently deleted.',
                    },
                ],
            },
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.TextDisplay,
                content: 'Use `/list` to view your remaining setups or `/setup` to create a new one.',
            },
        ],
    }));
}

export async function handleListDeleteCancel(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply({content: 'Edit session expired. Please start over.'});
    }

    return refreshCurrentStep(ctx, setupId, state);
}

export async function handleListToggleEnable(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply({content: 'Edit session expired. Please start over.'});
    }

    const updated = await updateSetupState(setupId, {disable: false});
    if (!updated) {
        return ctx.reply({content: 'Setup session expired. Please start over.', flags: MessageFlags.Ephemeral});
    }

    return refreshCurrentStep(ctx, setupId, updated);
}

export async function handleListToggleDisable(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply({content: 'Edit session expired. Please start over.', flags: MessageFlags.Ephemeral});
    }

    const updated = await updateSetupState(setupId, {disable: true});
    if (!updated) {
        return ctx.reply({content: 'Setup session expired. Please start over.', flags: MessageFlags.Ephemeral});
    }

    return refreshCurrentStep(ctx, setupId, updated);
}
