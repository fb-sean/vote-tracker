import {TWorker, IWorkerPayloadData, EWorkerJobs} from "@Types/RedisQueue";
import VoteModel from "@Schemas/Vote";
import SettingsModel from "@Schemas/Settings";
import UserDataModel from "@Schemas/UserData";
import {DiscordClient} from "@API/DiscordClient";
import {Routes} from "discord-api-types/v10";
import Redis from "@API/RedisCache";
import RedisQueue from "@API/RedisQueue";
import Logger from "@Utils/Logger";
import StreakService from "../Utils/StreakService";
import type {IComputeVotePayload, IVoteCounts, IStreakData, IUserData, ISendMessagePayload} from "@Types/Workers";

export default class ComputeVoteWorker implements TWorker {
    jobName = EWorkerJobs.ComputeVote;
    maxPerSecond = 50;
    maxDuration = 3000;

    async execute(payload: IWorkerPayloadData): Promise<void> {
        const data = payload as unknown as IComputeVotePayload;
        const startTime = Date.now();

        try {
            const settings = await SettingsModel.find({
                entity_id: data.entity_id,
                entity_type: data.entity_type,
                disabled: false
            });
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

                const entityStreak = await StreakService.updateEntityStreak(
                    data.user_id, data.entity_id, data.entity_type
                );

                const [voteCounts] = await Promise.all([
                    this.getVoteCounts(data),
                ]);

                const isFirstVote = entityStreak.voteCount <= 1;

                const streakData: IStreakData = {
                    current: entityStreak.current,
                    best: entityStreak.best,
                    last: entityStreak.previousVoteAt
                        ? ~~(entityStreak.previousVoteAt.getTime() / 1000)
                        : Date.now(),
                };

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
