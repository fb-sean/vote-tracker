import {Context} from "@Utils/Context";
import {ComponentType, MessageFlags, RESTPostAPIChannelMessageJSONBody,} from "discord-api-types/v10";
import {createEditState, getSetupState, type TSetupState, updateSetupState} from "@Utils/SetupManager";
import {
    buildChannelAndWebhookStep,
    buildEntityIdStep,
    buildMessagesStep,
    buildRewardsStep,
} from "@Utils/SetupComponents";

function buildPayload(components: RESTPostAPIChannelMessageJSONBody, flags?: number) {
    return {
        ...components,
        flags: flags || (MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral),
    };
}

export async function handleListEdit(ctx: Context, setupId: string, serverId: string) {
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

async function refreshCurrentStep(ctx: Context, setupId: string, state: TSetupState) {
    const step = state.current_step;

    if (step === 0) {
        return ctx.update(buildPayload({
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: '# Edit Vote Tracking',
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
        return ctx.update(buildPayload({
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: '# Review Changes',
                },
                {
                    type: ComponentType.Container,
                    accent_color: 5763719,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: `**Type:** ${state.entity_type === 'bot' ? 'Bot' : 'Server'}\n**Entity ID:** ${state.entity_id}\n${state.channel_id ? `**Logging Channel:** <#${state.channel_id}>\n` : ''}${state.external_webhook_url ? '**External Webhook:** Set\n' : ''}${state.rewards.length > 0 ? `**Reward Roles:** ${state.rewards.length}\n` : ''}${state.messages.length > 0 ? `**Messages:** ${state.messages.length} configured` : '**Messages:** Defaults'}`,
                        },
                    ],
                },
                {
                    type: ComponentType.Separator,
                    spacing: 1,
                },
                {
                    type: ComponentType.TextDisplay,
                    content: 'Click "Save Changes" to update your setup. The webhook URL and auth token remain unchanged.',
                },
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            style: 3,
                            label: 'Save Changes',
                            custom_id: `setup_finish_${setupId}`,
                        },
                        {
                            type: ComponentType.Button,
                            style: 2,
                            label: 'Dump JSON',
                            custom_id: `list_dump_${setupId}`,
                        },
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

    return ctx.reply({content: 'Invalid step.'});
}

export async function handleListBack(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply({content: 'Edit session expired. Please start over.'});
    }

    if (state.current_step === 1) {
        return ctx.update({
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: '# Edit Vote Tracking',
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

    const previous = await updateSetupState(setupId, {current_step: state.current_step - 1});
    if (!previous) {
        return ctx.reply({content: 'Cannot go back further.'});
    }

    return refreshCurrentStep(ctx, setupId, previous);
}

export async function handleListNext(ctx: Context, setupId: string) {
    const state = await getSetupState(setupId);
    if (!state) {
        return ctx.reply({content: 'Edit session expired. Please start over.'});
    }

    if (!state.entity_id) {
        return ctx.reply({content: 'Please enter your bot or server ID first.'});
    }

    const next = await updateSetupState(setupId, {current_step: state.current_step + 1});
    if (!next) {
        return ctx.reply({content: 'Cannot proceed further.'});
    }

    return refreshCurrentStep(ctx, setupId, next);
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
