import {TWorker, IWorkerPayloadData, EWorkerJobs} from "@Types/RedisQueue";
import VoteModel from "@Schemas/Vote";
import SettingsModel from "@Schemas/Settings";
import UserDataModel from "@Schemas/UserData";
import {DiscordClient} from "@API/DiscordClient";
import {Routes} from "discord-api-types/v10";
import Redis from "@API/RedisCache";
import RedisQueue from "@API/RedisQueue";
import Logger from "@Utils/Logger";
import type {IComputeVotePayload, IVoteCounts, IStreakData, IUserData, ISendMessagePayload} from "@Types/Workers";

export default class ComputeVoteWorker implements TWorker {
    jobName = EWorkerJobs.ComputeVote;
    maxPerSecond = 50;
    maxDuration = 3000;

    async execute(payload: IWorkerPayloadData): Promise<void> {
        const data = payload as unknown as IComputeVotePayload;
        const startTime = Date.now();

        try {
            Logger.info(`Processing vote for ${data.user_id} from ${data.platform}`, 'COMPUTE_VOTE');

            const settings = await SettingsModel.find({entity_id: data.entity_id, entity_type: data.entity_type, disabled: false});
            for (const setting of settings) {
                if (setting.disabled) {
                    Logger.info(`Settings not found or disabled for ${setting.server_id}, skipping post-processing`, 'COMPUTE_VOTE');

                    return;
                }

                await VoteModel.create({
                    user_id: data.user_id,
                    server_id: setting.server_id,
                    entity_type: data.entity_type,
                    entity_id: data.entity_id,
                    platform: data.platform,
                    is_test: data.type === 'test',
                });

                const [voteCounts, streakData, isFirstVote] = await Promise.all([
                    this.getVoteCounts(data),
                    this.getStreakData(data),
                    this.checkIsFirstVote(data),
                ]);

                const userData = await this.getOrFetchUserData(data);
                const userExistsInGuild = await this.checkUserInGuild(setting.server_id!, data.user_id);

                const jobs: Promise<unknown>[] = [];

                if (setting.channel_id) {
                    jobs.push(
                        RedisQueue.getInstance().addJob(EWorkerJobs.SendMessage, {
                            user_id: data.user_id,
                            entity_type: data.entity_type,
                            entity_id: data.entity_id,
                            platform: data.platform,
                            is_test: data.type === 'test',
                            vote_counts: voteCounts,
                            streak: streakData,
                            is_first_vote: isFirstVote,
                            user_data: userData,
                            settings: setting
                        })
                    );
                }

                if (setting.rewards && setting.rewards.length > 0 && userExistsInGuild) {
                    jobs.push(
                        RedisQueue.getInstance().addJob(EWorkerJobs.GiveRoles, {
                            user_id: data.user_id,
                            rewards: setting.rewards,
                            vote_counts: voteCounts,
                            settings: setting
                        })
                    );
                }

                if (setting.external_webhook_url) {
                    jobs.push(
                        RedisQueue.getInstance().addJob(EWorkerJobs.SendExternalWebhook, {
                            user_id: data.user_id,
                            entity_type: data.entity_type,
                            entity_id: data.entity_id,
                            guild_id: data.guild_id,
                            platform: data.platform,
                            is_test: data.type === 'test',
                            vote_counts: voteCounts,
                            streak: streakData,
                            is_first_vote: isFirstVote,
                            settings: setting
                        })
                    );
                }

                if (jobs.length > 0) {
                    await Promise.allSettled(jobs);
                } else {
                    Logger.info(`No post-processing jobs to queue for ${setting.server_id}`, 'COMPUTE_VOTE');
                }
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

        const [all, month, year, week] = await Promise.all([
            VoteModel.countDocuments({
                user_id: payload.user_id,
                entity_id: payload.entity_id,
                entity_type: payload.entity_type,
                is_test: false,
            }),
            VoteModel.countDocuments({
                user_id: payload.user_id,
                entity_id: payload.entity_id,
                entity_type: payload.entity_type,
                is_test: false,
                createdAt: {$gte: startOfMonth},
            }),
            VoteModel.countDocuments({
                user_id: payload.user_id,
                entity_id: payload.entity_id,
                entity_type: payload.entity_type,
                is_test: false,
                createdAt: {$gte: startOfYear},
            }),
            VoteModel.countDocuments({
                user_id: payload.user_id,
                entity_id: payload.entity_id,
                entity_type: payload.entity_type,
                is_test: false,
                createdAt: {$gte: startOfWeek},
            }),
        ]);

        return {all, month, year, week};
    }

    private async getStreakData(payload: IComputeVotePayload): Promise<IStreakData> {
        const userVotes = await VoteModel.find({
            user_id: payload.user_id,
            entity_id: payload.entity_id,
            entity_type: payload.entity_type,
            is_test: false,
        }).sort({createdAt: 1}).limit(1);

        if (!userVotes || userVotes.length === 0) {
            return {
                current: 1,
                best: 1,
                last: Date.now(),
            };
        }

        const current = await this.calculateCurrentStreak(payload);
        const streakGroups = await this.getStreakGroups(payload);
        const best = streakGroups.length > 0 ? Math.max(...streakGroups) : 1;

        const last = await VoteModel
            .findOne({
                user_id: payload.user_id,
                entity_id: payload.entity_id,
                entity_type: payload.entity_type,
                is_test: false,
            })
            .sort({createdAt: -1})
            .skip(1)
            .limit(1);

        return {
            current,
            best,
            last: last ? ~~((new Date(last.createdAt)).getTime() / 1000) : Date.now(),
        };
    }

    private async calculateCurrentStreak(payload: IComputeVotePayload): Promise<number> {
        const votes = await VoteModel.find({
            user_id: payload.user_id,
            entity_id: payload.entity_id,
            entity_type: payload.entity_type,
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
                entity_id: payload.entity_id,
                entity_type: payload.entity_type,
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
            entity_id: payload.entity_id,
            entity_type: payload.entity_type,
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

            const lastTime = currentGroup[currentGroup.length - 1];
            if (voteTime - lastTime <= oneDay * 2) {
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
            entity_id: payload.entity_id,
            entity_type: payload.entity_type,
            is_test: false,
        });

        return !existingVote;
    }

    private async getlast(payload: IComputeVotePayload): Promise<any> {
        const last = await VoteModel
            .findOne({
                user_id: payload.user_id,
                entity_id: payload.entity_id,
                entity_type: payload.entity_type,
                is_test: false,
            })
            .sort({createdAt: -1})
            .skip(1)
            .limit(1);

        return last;
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
            const cacheKey = `discord:vt:user_in_guild:${guildId}:${userId}`;
            const cached = await Redis.getInstance().get<string>(cacheKey);

            if (cached !== null) {
                return cached === 'true';
            }

            const permCacheKey = `discord:vt:guild_no_access:${guildId}`;
            const hasNoAccess = await Redis.getInstance().get<string>(permCacheKey);

            if (hasNoAccess === 'true') {
                Logger.warn(`No access to guild ${guildId} (cached), assuming user exists`, 'COMPUTE_VOTE');
                return true;
            }

            const bot = DiscordClient.getInstance();
            const member = await bot.rest.get(Routes.guildMember(guildId, userId));

            const exists = !!member;

            await Redis.getInstance().set(cacheKey, exists.toString(), 900);

            return exists;
        } catch (error: unknown) {
            const discordError = error as { code?: number };
            if (discordError.code === 50001 || discordError.code === 50004 || discordError.code === 10004) {
                const permCacheKey = `discord:vt:guild_no_access:${guildId}`;
                await Redis.getInstance().set(permCacheKey, 'true', 900);
                Logger.warn(`No access to guild ${guildId}, caching failure`, 'COMPUTE_VOTE');
            }
            return true;
        }
    }
}
