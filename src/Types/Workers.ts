export interface IComputeVotePayload {
    user_id: string;
    server_id: string;
    entity_type: 'bot' | 'server';
    entity_id: string;
    platform: string;
    is_test: boolean;
    guild_id?: string;
    rewards?: {
        milestone?: number;
        monthly?: number;
        streak?: number;
    };
}

export interface IVoteCounts {
    all: number;
    thisMonth: number;
    thisYear: number;
    thisWeek: number;
}

export interface IStreakData {
    current: number;
    best: number;
    lastVote: number;
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
    is_first_vote: boolean;
    user_data: IUserData | null;
    user_exists_in_guild: boolean;
}

export interface IMessagePlaceholders {
    'user.mention': string;
    'user.id': string;
    'user.username': string;
    'user.avatar': string;
    'votes.count.all': number;
    'votes.count.month': number;
    'votes.count.year': number;
    'votes.count.week': number;
    'votes.streak.current': number;
    'votes.streak.best': number;
    'platform': string;
    'entity.type': string;
    'entity.id': string;
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
}

export interface ISendExternalWebhookPayload {
    user_id: string;
    server_id: string;
    entity_type: 'bot' | 'server';
    entity_id: string;
    platform: string;
    is_test: boolean;
    vote_counts: IVoteCounts;
    streak: IStreakData;
    is_first_vote: boolean;
    user_data: IUserData | null;
}

export interface IUserData {
    userId: string;
    username: string;
    avatar: string;
}
