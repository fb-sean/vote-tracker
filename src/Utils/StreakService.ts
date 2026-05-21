import EntityStreakModel from '@Schemas/EntityStreak';
import VoteModel from '@Schemas/Vote';
import Logger from '@Utils/Logger';
import {IEntityRef, ILightweightStreakData, IStreakData} from "@Types/Streak";

const STREAK_WINDOW_MS = 26 * 60 * 60 * 1000; // 26 hours

class StreakService {
    /**
     * Update or create the entity-level streak record for a vote.
     * Uses an atomic aggregation pipeline to avoid race conditions
     * when concurrent votes arrive for the same user+entity.
     */
    static async updateEntityStreak(userId: string, entityId: string, entityType: string): Promise<IStreakData> {
        const now = new Date();
        const epoch = new Date(0);

        const result = await EntityStreakModel.findOneAndUpdate(
            {user_id: userId, entity_id: entityId, entity_type: entityType},
            [{
                $set: {
                    current_streak: {
                        $cond: {
                            if: {
                                $lte: [
                                    {$subtract: [now, {$ifNull: ['$last_vote_at', epoch]}]},
                                    STREAK_WINDOW_MS,
                                ],
                            },
                            then: {$add: [{$ifNull: ['$current_streak', 0]}, 1]},
                            else: 1,
                        },
                    },
                    best_streak: {
                        $cond: {
                            if: {
                                $lte: [
                                    {$subtract: [now, {$ifNull: ['$last_vote_at', epoch]}]},
                                    STREAK_WINDOW_MS,
                                ],
                            },
                            then: {
                                $max: [
                                    {$ifNull: ['$best_streak', 1]},
                                    {$add: [{$ifNull: ['$current_streak', 0]}, 1]},
                                ],
                            },
                            else: {$ifNull: ['$best_streak', 1]},
                        },
                    },
                    previous_vote_at: {$ifNull: ['$last_vote_at', null]},
                    last_vote_at: now,
                    vote_count: {$add: [{$ifNull: ['$vote_count', 0]}, 1]},
                },
            }],
            {upsert: true, new: true}
        );

        return {
            current: result!.current_streak,
            best: result!.best_streak,
            lastVoteAt: result!.last_vote_at,
            previousVoteAt: result!.previous_vote_at ?? null,
            voteCount: result!.vote_count,
        };
    }

    /**
     * Get entity streak, computing from votes if no streak record exists yet (lazy init).
     */
    static async getEntityStreakWithFallback(userId: string, entityId: string, entityType: string): Promise<IStreakData> {
        const existing = await EntityStreakModel.findOne({
            user_id: userId,
            entity_id: entityId,
            entity_type: entityType,
        });

        if (existing) {
            return {
                current: existing.current_streak,
                best: existing.best_streak,
                lastVoteAt: existing.last_vote_at,
                previousVoteAt: (existing as any).previous_vote_at ?? null,
                voteCount: existing.vote_count,
            };
        }

        const votes = await VoteModel.find({
            user_id: userId,
            entity_id: entityId,
            entity_type: entityType,
            is_test: false,
        }).sort({createdAt: 1});

        if (votes.length === 0) {
            return {
                current: 0,
                best: 0,
                lastVoteAt: new Date(),
                previousVoteAt: null,
                voteCount: 0,
            };
        }

        const {current, best} = StreakService.computeStreaksFromVotes(votes);
        const lastVoteAt = new Date(votes[votes.length - 1].createdAt!);

        await EntityStreakModel.create({
            user_id: userId,
            entity_id: entityId,
            entity_type: entityType,
            current_streak: current || 1,
            best_streak: best,
            last_vote_at: lastVoteAt,
            vote_count: votes.length,
        });

        return {
            current: current || 1,
            best,
            lastVoteAt,
            previousVoteAt: null,
            voteCount: votes.length,
        };
    }

    /**
     * Get aggregated streak data for a user across multiple entities.
     * Aggregates: max(current_streak), max(best_streak), sum(vote_count).
     * Used by /me command to show overall streak across all entities in a server.
     */
    static async getAggregatedEntityStreak(userId: string, entities: IEntityRef[]): Promise<IStreakData> {
        if (entities.length === 0) {
            return {
                current: 0,
                best: 0,
                lastVoteAt: new Date(),
                previousVoteAt: null,
                voteCount: 0,
            };
        }

        const orConditions = entities.map(e => ({
            entity_id: e.entityId,
            entity_type: e.entityType,
        }));

        const streakRecords = await EntityStreakModel.find({
            user_id: userId,
            $or: orConditions,
        });

        const entitiesWithRecords = new Set(
            streakRecords.map(r => `${r.entity_id}_${r.entity_type}`)
        );

        const entitiesNeedingFallback = entities.filter(
            e => !entitiesWithRecords.has(`${e.entityId}_${e.entityType}`)
        );

        for (const entity of entitiesNeedingFallback) {
            try {
                await StreakService.getEntityStreakWithFallback(userId, entity.entityId, entity.entityType);
            } catch (error) {
                Logger.error(
                    `Failed to compute entity streak fallback for user ${userId}, ` +
                    `entity ${entity.entityId}: ${error}`
                );
            }
        }

        const allRecords = entitiesNeedingFallback.length > 0
            ? await EntityStreakModel.find({user_id: userId, $or: orConditions})
            : streakRecords;

        if (allRecords.length === 0) {
            return {
                current: 0,
                best: 0,
                lastVoteAt: new Date(),
                previousVoteAt: null,
                voteCount: 0,
            };
        }

        let maxCurrent = 0;
        let maxBest = 0;
        let totalVotes = 0;
        let latestVoteAt = new Date(0);
        let latestPreviousVoteAt: Date | null = null;

        for (const record of allRecords) {
            maxCurrent = Math.max(maxCurrent, record.current_streak);
            maxBest = Math.max(maxBest, record.best_streak);
            totalVotes += record.vote_count;
            if (record.last_vote_at > latestVoteAt) {
                latestVoteAt = record.last_vote_at;
            }
            const prev = (record as any).previous_vote_at;
            if (prev && (!latestPreviousVoteAt || prev > latestPreviousVoteAt)) {
                latestPreviousVoteAt = prev;
            }
        }

        return {
            current: maxCurrent,
            best: maxBest,
            lastVoteAt: latestVoteAt,
            previousVoteAt: latestPreviousVoteAt,
            voteCount: totalVotes,
        };
    }

    /**
     * Get all entity streaks for a specific entity, with lazy fallback.
     * Used by leaderboard when filtering by a specific entity.
     */
    static async getEntityStreaksForEntity(entityId: string, entityType: string): Promise<Map<string, ILightweightStreakData>> {
        const result = new Map<string, ILightweightStreakData>();

        const streakRecords = await EntityStreakModel.find({
            entity_id: entityId,
            entity_type: entityType,
        });

        const usersWithRecords = new Set<string>();

        for (const record of streakRecords) {
            result.set(record.user_id, {
                current: record.current_streak,
                best: record.best_streak,
                voteCount: record.vote_count,
            });
            usersWithRecords.add(record.user_id);
        }

        const usersWithVotes = await VoteModel.distinct('user_id', {
            entity_id: entityId,
            entity_type: entityType,
            is_test: false,
        });

        const usersNeedingFallback = usersWithVotes.filter(uid => !usersWithRecords.has(uid));

        for (const userId of usersNeedingFallback) {
            try {
                const streakData = await StreakService.getEntityStreakWithFallback(userId, entityId, entityType);
                result.set(userId, {
                    current: streakData.current,
                    best: streakData.best,
                    voteCount: streakData.voteCount,
                });
            } catch (error) {
                Logger.error(`Failed to compute entity streak fallback for user ${userId}: ${error}`);
            }
        }

        return result;
    }

    /**
     * Get aggregated streak data for all users across multiple entities.
     * Groups EntityStreak records by user_id and aggregates:
     *   max(current_streak), max(best_streak), sum(vote_count)
     * Used by leaderboard for "All Entities" mode.
     */
    static async getAggregatedEntityStreaksForEntities(entities: IEntityRef[]): Promise<Map<string, ILightweightStreakData>> {
        const result = new Map<string, ILightweightStreakData>();

        if (entities.length === 0) {
            return result;
        }

        const orConditions = entities.map(e => ({
            entity_id: e.entityId,
            entity_type: e.entityType,
        }));

        const streakRecords = await EntityStreakModel.find({
            $or: orConditions,
        });

        const userAggregation = new Map<string, { current: number; best: number; voteCount: number }>();

        for (const record of streakRecords) {
            const existing = userAggregation.get(record.user_id);
            if (existing) {
                existing.current = Math.max(existing.current, record.current_streak);
                existing.best = Math.max(existing.best, record.best_streak);
                existing.voteCount += record.vote_count;
            } else {
                userAggregation.set(record.user_id, {
                    current: record.current_streak,
                    best: record.best_streak,
                    voteCount: record.vote_count,
                });
            }
        }

        for (const [userId, data] of userAggregation) {
            result.set(userId, data);
        }

        const usersWithRecords = new Set(userAggregation.keys());

        const usersWithVotes = await VoteModel.distinct('user_id', {
            $or: orConditions.map(e => ({
                entity_id: e.entity_id,
                entity_type: e.entity_type,
                is_test: false,
            })),
        });

        const usersNeedingFallback = usersWithVotes.filter(uid => !usersWithRecords.has(uid));

        for (const userId of usersNeedingFallback) {
            try {
                let maxCurrent = 0;
                let maxBest = 0;
                let totalVotes = 0;

                for (const entity of entities) {
                    const streakData = await StreakService.getEntityStreakWithFallback(
                        userId, entity.entityId, entity.entityType
                    );
                    maxCurrent = Math.max(maxCurrent, streakData.current);
                    maxBest = Math.max(maxBest, streakData.best);
                    totalVotes += streakData.voteCount;
                }

                result.set(userId, {
                    current: maxCurrent,
                    best: maxBest,
                    voteCount: totalVotes,
                });
            } catch (error) {
                Logger.error(`Failed to compute aggregated streak fallback for user ${userId}: ${error}`);
            }
        }

        return result;
    }

    /**
     * Compute streak data from raw votes (used for lazy initialization).
     * This is the fallback when no pre-computed streak exists.
     */
    private static computeStreaksFromVotes(votes: Array<{ createdAt: Date }>): {
        current: number;
        best: number;
    } {
        const sortedVotes = votes.map(v => new Date(v.createdAt).getTime()).sort((a, b) => a - b);
        const streakWindow = STREAK_WINDOW_MS;

        let currentStreak = 0;
        let streakCheckTime = Date.now();

        for (let i = sortedVotes.length - 1; i >= 0; i--) {
            const voteTime = sortedVotes[i];
            if (streakCheckTime - voteTime > streakWindow) {
                if (i < sortedVotes.length - 1) {
                    const nextVoteTime = sortedVotes[i + 1];
                    if (nextVoteTime - voteTime > streakWindow) break;
                } else {
                    break;
                }
            }
            currentStreak++;
            streakCheckTime = voteTime;
        }

        let bestStreak = 1;
        let currentChain = 1;

        for (let i = 1; i < sortedVotes.length; i++) {
            const timeDiff = sortedVotes[i] - sortedVotes[i - 1];
            if (timeDiff <= streakWindow) {
                currentChain++;
            } else {
                bestStreak = Math.max(bestStreak, currentChain);
                currentChain = 1;
            }
        }
        bestStreak = Math.max(bestStreak, currentChain);

        return {
            current: currentStreak,
            best: bestStreak,
        };
    }
}

export default StreakService;
