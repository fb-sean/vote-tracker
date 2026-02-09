import {TWorker, IWorkerPayloadData, EWorkerJobs} from "@Types/RedisQueue";
import VoteModel from "@Schemas/Vote";
import SettingsModel from "@Schemas/Settings";
import UserDataModel from "@Schemas/UserData";
import {DiscordClient} from "@API/DiscordClient";
import {Routes} from "discord-api-types/v10";
import Redis from "@API/RedisCache";
import RedisQueue from "@API/RedisQueue";
import Logger from "@Utils/Logger";
import type {IComputeVotePayload, IVoteCounts, IStreakData, IUserData} from "@Types/Workers";

export default class ComputeVoteWorker implements TWorker {
    jobName = EWorkerJobs.ComputeVote;
    maxPerSecond = 50;
    maxDuration = 3000;

    async execute(payload: IWorkerPayloadData): Promise<void> {
        const data = payload as unknown as IComputeVotePayload;
        const startTime = Date.now();

        try {
            Logger.info(`Processing vote for ${data.user_id} from ${data.platform}`, 'COMPUTE_VOTE');

            await VoteModel.create({
                user_id: data.user_id,
                server_id: data.server_id,
                entity_type: data.entity_type,
                entity_id: data.entity_id,
                platform: data.platform,
                is_test: data.is_test,
                guild_id: data.guild_id || null,
            });

            const settings = await SettingsModel.findOne({server_id: data.server_id});

            if (!settings || settings.disabled) {
                Logger.info(`Settings not found or disabled for ${data.server_id}, skipping post-processing`, 'COMPUTE_VOTE');

                return;
            }

            const [voteCounts, streakData, isFirstVote] = await Promise.all([
                this.getVoteCounts(data),
                this.getStreakData(data),
                this.checkIsFirstVote(data),
            ]);

            const userData = await this.getOrFetchUserData(data);

            const userExistsInGuild = data.guild_id
                ? await this.checkUserInGuild(data.guild_id, data.user_id)
                : true;

            const jobs: Promise<unknown>[] = [];

            if (settings.channel_id) {
                jobs.push(
                    RedisQueue.getInstance().addJob(EWorkerJobs.SendMessage, {
                        user_id: data.user_id,
                        server_id: data.server_id,
                        entity_type: data.entity_type,
                        entity_id: data.entity_id,
                        platform: data.platform,
                        is_test: data.is_test,
                        vote_counts: voteCounts,
                        streak: streakData,
                        is_first_vote: isFirstVote,
                        user_data: userData,
                        user_exists_in_guild: userExistsInGuild,
                    })
                );
            }

            if (settings.rewards && settings.rewards.length > 0) {
                jobs.push(
                    RedisQueue.getInstance().addJob(EWorkerJobs.GiveRoles, {
                        user_id: data.user_id,
                        server_id: data.server_id,
                        rewards: data.rewards,
                        vote_counts: voteCounts,
                    })
                );
            }

            if (settings.external_webhook_url) {
                jobs.push(
                    RedisQueue.getInstance().addJob(EWorkerJobs.SendExternalWebhook, {
                        user_id: data.user_id,
                        server_id: data.server_id,
                        entity_type: data.entity_type,
                        entity_id: data.entity_id,
                        platform: data.platform,
                        is_test: data.is_test,
                        vote_counts: voteCounts,
                        streak: streakData,
                        is_first_vote: isFirstVote,
                        user_data: userData,
                    })
                );
            }

            if (jobs.length > 0) {
                await Promise.allSettled(jobs);
            } else {
                Logger.info(`No post-processing jobs to queue for ${data.server_id}`, 'COMPUTE_VOTE');
            }

            const duration = Date.now() - startTime;

            Logger.info(`ComputeVote completed in ${duration}ms`, 'COMPUTE_VOTE');
        } catch (error) {
            Logger.error(`Error in ComputeVote: ${error}`, 'COMPUTE_VOTE');
            console.log(error);
        }
    }

    private async getVoteCounts(payload: IComputeVotePayload): Promise<IVoteCounts> {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());

        const [all, thisMonth, thisYear, thisWeek] = await Promise.all([
            VoteModel.countDocuments({
                user_id: payload.user_id,
                server_id: payload.server_id,
                is_test: false,
            }),
            VoteModel.countDocuments({
                user_id: payload.user_id,
                server_id: payload.server_id,
                is_test: false,
                createdAt: {$gte: startOfMonth},
            }),
            VoteModel.countDocuments({
                user_id: payload.user_id,
                server_id: payload.server_id,
                is_test: false,
                createdAt: {$gte: startOfYear},
            }),
            VoteModel.countDocuments({
                user_id: payload.user_id,
                server_id: payload.server_id,
                is_test: false,
                createdAt: {$gte: startOfWeek},
            }),
        ]);

        return {all, thisMonth, thisYear, thisWeek};
    }

    private async getStreakData(payload: IComputeVotePayload): Promise<IStreakData> {
        const userVotes = await VoteModel.find({
            user_id: payload.user_id,
            server_id: payload.server_id,
            is_test: false,
        }).sort({createdAt: 1}).limit(1);

        if (!userVotes || userVotes.length === 0) {
            return {
                current: 1,
                best: 1,
                lastVote: Date.now(),
            };
        }

        const current = await this.calculateCurrentStreak(payload);
        const streakGroups = await this.getStreakGroups(payload);
        const best = streakGroups.length > 0 ? Math.max(...streakGroups) : 1;

        return {
            current,
            best,
            lastVote: Date.now(),
        };
    }

    private async calculateCurrentStreak(payload: IComputeVotePayload): Promise<number> {
        const votes = await VoteModel.find({
            user_id: payload.user_id,
            server_id: payload.server_id,
            is_test: false,
        }).sort({createdAt: -1}).limit(1);

        if (!votes || votes.length === 0) {
            return 1;
        }

        const now = Date.now();
        const voteTime = new Date(votes[0].createdAt).getTime();
        const oneDay = 24 * 60 * 60 * 1000;

        if (now - voteTime > 2 * oneDay) {
            return 1;
        }

        let streak = 1;
        let checkDate = new Date(voteTime);
        checkDate.setDate(checkDate.getDate() - 1);

        while (true) {
            const dayStart = new Date(checkDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(checkDate);
            dayEnd.setHours(23, 59, 59, 999);

            const voteInDay = await VoteModel.findOne({
                user_id: payload.user_id,
                server_id: payload.server_id,
                is_test: false,
                createdAt: {$gte: dayStart, $lte: dayEnd},
            });

            if (voteInDay) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    }

    private async getStreakGroups(payload: IComputeVotePayload): Promise<number[]> {
        const votes = await VoteModel.find({
            user_id: payload.user_id,
            server_id: payload.server_id,
            is_test: false,
        }).sort({createdAt: 1});

        if (!votes || votes.length === 0) {
            return [];
        }

        const groups: number[][] = [];
        let currentGroup: number[] = [];

        for (let i = 0; i < votes.length; i++) {
            const voteTime = new Date(votes[i].createdAt).getTime();
            const oneDay = 24 * 60 * 60 * 1000;

            if (currentGroup.length === 0) {
                currentGroup.push(voteTime);
                continue;
            }

            const lastVoteTime = currentGroup[currentGroup.length - 1];
            if (voteTime - lastVoteTime <= oneDay * 2) {
                currentGroup.push(voteTime);
            } else {
                groups.push(currentGroup);
                currentGroup = [voteTime];
            }
        }

        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }

        return groups.map(g => g.length);
    }

    private async checkIsFirstVote(payload: IComputeVotePayload): Promise<boolean> {
        const existingVote = await VoteModel.findOne({
            user_id: payload.user_id,
            server_id: payload.server_id,
            is_test: false,
        });

        return !existingVote;
    }

    private async getOrFetchUserData(payload: IComputeVotePayload): Promise<IUserData | null> {
        const userData = await UserDataModel.findOne({userId: payload.user_id});

        if (!userData) {
            return null;
        }

        return {
            userId: userData.userId || '',
            username: userData.username || '',
            avatar: userData.avatar || '',
        };
    }

    private async checkUserInGuild(guildId: string, userId: string): Promise<boolean> {
        try {
            const cacheKey = `user_in_guild:${guildId}:${userId}`;
            const cached = await Redis.getInstance().get<string>(cacheKey);

            if (cached !== null) {
                return cached === 'true';
            }

            const bot = DiscordClient.getInstance();
            const member = await bot.rest.get(Routes.guildMember(guildId, userId));

            const exists = !!member;

            await Redis.getInstance().set(cacheKey, exists.toString(), 300);

            return exists;
        } catch {
            return true;
        }
    }
}
