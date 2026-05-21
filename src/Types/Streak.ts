export interface ILightweightStreakData {
    current: number;
    best: number;
    voteCount: number;
}

export interface IStreakData extends ILightweightStreakData {
    lastVoteAt: Date;
    previousVoteAt: Date | null;
}

export interface IEntityRef {
    entityId: string;
    entityType: string;
}