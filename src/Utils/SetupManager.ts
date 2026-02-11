import {randomBytes} from "crypto";
import {ButtonStyle, ComponentType} from "discord-api-types/v10";
import Redis from "@API/RedisCache";
import SettingsModel from "@Schemas/Settings";
import TopggConnectionModel from "@Schemas/Integrations/Topgg";

export type TRewardRole = {
    role_id: string;
    duration_min: number;
    min_votes: number;
};

export type TSetupMessage = {
    type: 'first-vote' | 'vote';
    payload: string;
};

export type TSetupState = {
    current_step: number;
    server_id: string;
    user_id: string;
    entity_type: 'bot' | 'server' | 'game' | null;
    entity_id: string | null | '';
    channel_id: string | null;
    external_webhook_url: string | null;
    messages: TSetupMessage[];
    rewards: TRewardRole[];
    auth_token: string | null;
    editing_id: string | null;
    disable?: boolean;
};

const SETUP_STEPS = [
    'entity_type',
    'entity_id',
    'channel_and_webhook',
    'messages',
    'rewards',
    'complete'
] as const;

export type TSetupStep = typeof SETUP_STEPS[number];

export async function createSetupState(serverId: string, userId: string): Promise<string> {
    const setupId = randomBytes(16).toString('hex');

    const initialState: TSetupState = {
        current_step: 0,
        server_id: serverId,
        user_id: userId,
        entity_type: null,
        entity_id: null,
        channel_id: null,
        external_webhook_url: null,
        messages: [],
        rewards: [],
        auth_token: null,
        editing_id: null,
    };

    await Redis.getInstance().set(`discord:vt:setup:${setupId}`, initialState, 60 * 30);

    return setupId;
}

export async function getSetupState(setupId: string): Promise<TSetupState | null> {
    return Redis.getInstance().get<TSetupState>(`discord:vt:setup:${setupId}`);
}

export async function updateSetupState(setupId: string, updates: Partial<TSetupState>): Promise<TSetupState | null> {
    const current = await getSetupState(setupId);
    if (!current) {
        return null;
    }

    const updated = {...current, ...updates};
    await Redis.getInstance().set(`discord:vt:setup:${setupId}`, updated, 60 * 30);

    return updated;
}

export async function deleteSetupState(setupId: string): Promise<void> {
    await Redis.getInstance().delete(`discord:vt:setup:${setupId}`);
}

export async function nextStep(setupId: string): Promise<TSetupState | null> {
    const state = await getSetupState(setupId);
    if (!state || state.current_step >= SETUP_STEPS.length - 1) {
        return null;
    }

    return updateSetupState(setupId, {current_step: state.current_step + 1});
}

export async function previousStep(setupId: string): Promise<TSetupState | null> {
    const state = await getSetupState(setupId);
    if (!state || state.current_step <= 0) {
        return null;
    }

    return updateSetupState(setupId, {current_step: state.current_step - 1});
}

export async function countSetupsForServer(serverId: string): Promise<number> {
    return SettingsModel.countDocuments({server_id: serverId});
}

export async function checkForDuplicateEntityId(entityId: string, excludeId?: string): Promise<boolean> {
    const query: any = {
        entity_id: entityId,
        disabled: false,
    };

    if (excludeId) {
        query._id = {$ne: excludeId};
    }

    const existing = await SettingsModel.findOne(query);
    return !!existing;
}

export async function saveSetupToDatabase(setupId: string): Promise<{ success: boolean, error?: string }> {
    const state = await getSetupState(setupId);
    if (!state || !state.entity_type || !state.entity_id) {
        return {success: false};
    }

    if (state.editing_id) {
        const existing = await SettingsModel.findById(state.editing_id);
        if (!existing) {
            return {success: false};
        }

        const wasDisabled = existing.disabled;
        const willBeEnabled = !state.disable;

        if ((wasDisabled && !willBeEnabled) || existing.entity_id !== state.entity_id) {
            const hasDuplicate = await checkForDuplicateEntityId(state.entity_id, state.editing_id);
            if (hasDuplicate) {
                return {
                    success: false,
                    error: `This entity ID (\`${state.entity_id}\`) is already in use by another active setup. If you want to use it for this entity:\n\n1. Delete the integration in the Top.gg settings\n2. Enable this setup again\n3. Or contact support for assistance`,
                };
            }
        }

        existing.entity_id = state.entity_id;
        existing.entity_type = state.entity_type;
        existing.channel_id = state.channel_id;
        existing.external_webhook_url = state.external_webhook_url;
        existing.set('rewards', state.rewards);
        existing.set('messages', state.messages);
        existing.disabled = state.disable || false;

        await existing.save();
        await deleteSetupState(setupId);

        return {success: true};
    } else {
        const hasDuplicate = await checkForDuplicateEntityId(state.entity_id);
        if (hasDuplicate) {
            return {
                success: false,
                error: `This entity ID (\`${state.entity_id}\`) is already in use by another active setup. If you want to use it for this entity:\n\n1. Delete the integration in the Top.gg settings\n2. Try creating this setup again\n3. Or contact support for assistance`,
            };
        }

        const hasConnection = await TopggConnectionModel.findOne({
            project_platform_id: state.entity_id,
            project_type: state.entity_type
        });
        if (hasConnection && hasConnection.user_id !== state.user_id) {
            return {
                success: false,
                error: `This entity ID (\`${state.entity_id}\`) is already connected to another Discord account. If you want to use it for this entity:\n\n1. Delete the integration in the Top.gg settings\n2. Try creating this setup again\n3. Or contact support for assistance`,
            };
        }

        state.messages = [
            {type: 'first-vote', payload: '{user.mention} has voted for the first time! 🎉'},
            {type: 'vote', payload: '{user.mention} has voted! Total votes: {votes.count.all}'},
        ];
    }

    if (!state.auth_token) {
        return {success: false};
    }

    const existingCount = await countSetupsForServer(state.server_id);
    if (existingCount >= 25) {
        return {success: false};
    }

    await SettingsModel.create({
        server_id: state.server_id,
        entity_id: state.entity_id,
        entity_type: state.entity_type,
        channel_id: state.channel_id,
        auth_token: state.auth_token,
        external_webhook_url: state.external_webhook_url,
        rewards: state.rewards,
        messages: state.messages,
        disabled: state.disable || false,
    });

    await deleteSetupState(setupId);

    return {success: true};
}

export async function getAllSetupsForServer(serverId: string) {
    return SettingsModel.find({server_id: serverId});
}

export async function createEditState(setupId: string, userId: string): Promise<string | null> {
    const setup = await SettingsModel.findById(setupId);
    if (!setup) {
        return null;
    }

    const sessionId = randomBytes(16).toString('hex');

    const editState: TSetupState = {
        current_step: 0,
        server_id: setup.server_id || '',
        user_id: userId,
        entity_type: setup.entity_type as 'bot' | 'server' | 'game',
        entity_id: setup.entity_id || '',
        channel_id: setup.channel_id || null,
        external_webhook_url: setup.external_webhook_url || null,
        messages: setup.messages.map((m: any) => ({type: m.type, payload: m.payload})) as TSetupMessage[],
        rewards: setup.rewards.map((r: any) => ({
            role_id: r.role_id || '',
            min_votes: r.min_votes,
            duration_min: r.duration_min
        })) as TRewardRole[],
        auth_token: setup.auth_token || null,
        editing_id: setupId,
        disable: setup.disabled || false,
    };

    await Redis.getInstance().set(`discord:vt:setup:${sessionId}`, editState, 60 * 30);

    return sessionId;
}

export async function getUnsetupConnections(userId: string) {
    const connections = await TopggConnectionModel.find({
        user_id: userId,
        project_type: 'bot',
    });

    if (connections.length === 0) {
        return [];
    }

    const platformIds = connections.map(c => c.project_platform_id).filter((id): id is string => !!id);
    const setupEntityIds = await SettingsModel.find({
        entity_id: {$in: platformIds},
    }).distinct('entity_id');

    return connections.filter(c => c.project_platform_id && !setupEntityIds.includes(c.project_platform_id));
}

export async function shouldShowUnsetupConnections(userId: string): Promise<boolean> {
    const unsetupConnections = await getUnsetupConnections(userId);
    return unsetupConnections.length > 0;
}

export function buildSetupList(setups: any[], serverId: string) {
    const components: any[] = [
        {
            type: ComponentType.TextDisplay,
            content: '# Vote Tracking Setups',
        },
    ];

    if (setups.length === 0) {
        components.push({
            type: ComponentType.TextDisplay,
            content: 'No setups found. Use `/setup` to create one!',
        });
    } else {
        const enabledSetups = setups.filter((s) => !s.disabled);
        const disabledSetups = setups.filter((s) => s.disabled);

        components.push({
            type: ComponentType.TextDisplay,
            content: `You have ${enabledSetups.length} setup${enabledSetups.length !== 1 ? 's' : ''} configured${disabledSetups.length > 0 ? ` (${disabledSetups.length} disabled)` : ''}.`,
        });
        components.push({
            type: ComponentType.Separator,
            spacing: 1,
        });

        for (let i = 0; i < setups.length; i++) {
            const setup = setups[i];
            const isDisabled = setup.disabled;
            const entityLabel = setup.entity_type === 'bot' ? `<@${setup.entity_id}>` : setup.entity_type === 'game' ? 'Game' : 'Server';
            const statusBadge = isDisabled ? ' 🔴 **Disabled**' : '';

            components.push({
                type: ComponentType.Section,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `**${i + 1}. ${entityLabel}** (${setup.entity_id})${statusBadge}${setup.channel_id ? `\n📢 Logging: <#${setup.channel_id}>` : ''}${setup.external_webhook_url ? '\n🔗 External webhook' : ''}${setup.rewards.length > 0 ? `\n🎁 ${setup.rewards.length} reward${setup.rewards.length > 1 ? 's' : ''}` : ''}`,
                    }
                ],
                accessory: {
                    type: ComponentType.Button,
                    style: isDisabled ? ButtonStyle.Success : ButtonStyle.Secondary,
                    label: isDisabled ? 'Enable' : 'Edit',
                    custom_id: `list_edit_${setup._id}_${serverId}`,
                },
            });
        }
    }

    components.push({
        type: ComponentType.Separator,
        spacing: 1,
    });

    return {components};
}
