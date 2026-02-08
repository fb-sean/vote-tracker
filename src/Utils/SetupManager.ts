import {randomBytes} from "crypto";
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
    entity_id: string | null;
    channel_id: string | null;
    external_webhook_url: string | null;
    messages: TSetupMessage[];
    rewards: TRewardRole[];
    auth_token: string | null;
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
    };

    await Redis.getInstance().set(`setup:${setupId}`, initialState, 60 * 30);

    return setupId;
}

export async function getSetupState(setupId: string): Promise<TSetupState | null> {
    return Redis.getInstance().get<TSetupState>(`setup:${setupId}`);
}

export async function updateSetupState(setupId: string, updates: Partial<TSetupState>): Promise<TSetupState | null> {
    const current = await getSetupState(setupId);
    if (!current) {
        return null;
    }

    const updated = {...current, ...updates};
    await Redis.getInstance().set(`setup:${setupId}`, updated, 60 * 30);

    return updated;
}

export async function deleteSetupState(setupId: string): Promise<void> {
    await Redis.getInstance().delete(`setup:${setupId}`);
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
    if (!state || !state.entity_type || !state.entity_id || !state.auth_token) {
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
