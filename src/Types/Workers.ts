import {Settings} from "@Schemas/Settings";

export interface IComputeVotePayload {
    type: string;
    user_id: string;
    entity_id: string;
    entity_type: 'bot' | 'server';
    platform: string;
    guild_id?: string;
}

export interface IVoteCounts {
    all: number;
    month: number;
    year: number;
    week: number;
}

export interface IStreakData {
    current: number;
    best: number;
    last: number;
}

export interface IDisconnectedTopggWebhookPayload {
    entity_type: 'bot' | 'server';
    entity_id: string;
}

export interface ISendMessagePayload {
    user_id: string;
    server_id: string;
    entity_type: 'bot' | 'server';
    entity_id: string;
    platform: string;
    is_test: boolean;
    vote_counts: IVoteCounts;
    streak: IStreakData;
    last_vote: number;
    is_first_vote: boolean;
    user_data: IUserData | null;
    settings: Settings;
}

export interface IMessagePlaceholders {
    'user.mention': string;
    'user.id': string;
    'user.username': string;
    'user.avatar': string;
    'user.avatar.animated': string;
    'votes.count.all': number;
    'votes.count.month': number;
    'votes.count.year': number;
    'votes.count.week': number;
    'votes.streak.current': number;
    'votes.streak.best': number;
    'votes.streak.last': number;
    'entity.type': string;
    'entity.id': string;
    'platform': string;
}

export interface IGiveRolesPayload {
    user_id: string;
    server_id: string;
    rewards: {
        milestone?: number;
        monthly?: number;
        streak?: number;
    };
    vote_counts: IVoteCounts;
    settings: Settings;
}

export interface ISendExternalWebhookPayload {
    user_id: string;
    entity_type: 'bot' | 'server';
    entity_id: string;
    guild_id?: string;
    platform: string;
    is_test: boolean;
    vote_counts: IVoteCounts;
    streak: IStreakData;
    is_first_vote: boolean;
    settings: Settings;
}

export interface IUserData {
    userId: string;
    username: string;
    avatar: string;
}

export interface IRemoveRolesPayload {
    guild_id: string;
    user_id: string;
    role_id: string;
}
