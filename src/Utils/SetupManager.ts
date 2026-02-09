import {randomBytes} from "crypto";
import {ComponentType} from "discord-api-types/v10";
import Redis from "@API/RedisCache";
import SettingsModel from "@Schemas/Settings";

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
    entity_type: 'bot' | 'server' | null;
    entity_id: string | null | '';
    channel_id: string | null;
    external_webhook_url: string | null;
    messages: TSetupMessage[];
    rewards: TRewardRole[];
    auth_token: string | null;
    editing_id: string | null;
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

export async function getCurrentStep(setupId: string): Promise<TSetupStep | null> {
    const state = await getSetupState(setupId);
    if (!state) {
        return null;
    }

    return SETUP_STEPS[state.current_step] || null;
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

export async function generateAuthToken(): Promise<string> {
    return randomBytes(32).toString('hex');
}

export async function countSetupsForServer(serverId: string): Promise<number> {
    return SettingsModel.countDocuments({server_id: serverId});
}

export async function saveSetupToDatabase(setupId: string): Promise<boolean> {
    const state = await getSetupState(setupId);
    if (!state || !state.entity_type || !state.entity_id) {
        return false;
    }

    if (state.editing_id) {
        const existing = await SettingsModel.findById(state.editing_id);
        if (!existing) {
            return false;
        }

        existing.entity_id = state.entity_id;
        existing.entity_type = state.entity_type;
        existing.channel_id = state.channel_id;
        existing.external_webhook_url = state.external_webhook_url;
        existing.set('rewards', state.rewards);
        existing.set('messages', state.messages);

        await existing.save();
        await deleteSetupState(setupId);

        return true;
    }

    if (!state.auth_token) {
        return false;
    }

    const existingCount = await countSetupsForServer(state.server_id);
    if (existingCount >= 25) {
        return false;
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
    });

    await deleteSetupState(setupId);

    return true;
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
        entity_type: setup.entity_type as 'bot' | 'server',
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
    };

    await Redis.getInstance().set(`discord:vt:setup:${sessionId}`, editState, 60 * 30);

    return sessionId;
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
        components.push({
            type: ComponentType.TextDisplay,
            content: `You have ${setups.length} setup${setups.length > 1 ? 's' : ''} configured.`,
        });
        components.push({
            type: ComponentType.Separator,
            spacing: 1,
        });

        for (let i = 0; i < setups.length; i++) {
            const setup = setups[i];
            components.push({
                type: ComponentType.Section,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `**${i + 1}. ${setup.entity_type === 'bot' ? `<@${setup.entity_id}>` : 'Server'}** (${setup.entity_id})${setup.channel_id ? `\n📢 Logging: <#${setup.channel_id}>` : ''}${setup.external_webhook_url ? '\n🔗 External webhook' : ''}${setup.rewards.length > 0 ? `\n🎁 ${setup.rewards.length} reward${setup.rewards.length > 1 ? 's' : ''}` : ''}`,
                    }
                ],
                accessory: {
                    type: ComponentType.Button,
                    style: 2,
                    label: 'Edit',
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
