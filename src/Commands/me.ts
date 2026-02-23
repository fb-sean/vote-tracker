import {Context} from "@Utils/Context";
import {Command} from "@Types/Discord";
import {
    ApplicationIntegrationType,
    InteractionContextType,
    MessageFlags,
    ComponentType, ButtonStyle,
} from "discord-api-types/v10";
import VoteModel from "@Schemas/Vote";
import SettingsModel from "@Schemas/Settings";
import Logger from "@Utils/Logger";

type MessageComponent = any;

function formatTimeBetweenVotes(avgHours: number): string {
    if (avgHours < 1) {
        const minutes = Math.round(avgHours * 60);

        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (avgHours < 24) {
        const hours = Math.round(avgHours * 10) / 10;

        return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
        const days = Math.round((avgHours / 24) * 10) / 10;

        return `${days} day${days !== 1 ? 's' : ''}`;
    }
}

function calculateStreaks(votes: Date[]): { currentStreak: number; bestStreak: number } {
    const streakWindow = 48 * 60 * 60 * 1000;
    const sortedVotes = votes.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    let currentStreak = 0;
    let streakCheckTime = Date.now();

    for (let i = sortedVotes.length - 1; i >= 0; i--) {
        const voteTime = new Date(sortedVotes[i]).getTime();

        if (streakCheckTime - voteTime > streakWindow) {
            if (i < sortedVotes.length - 1) {
                const nextVoteTime = new Date(sortedVotes[i + 1]).getTime();

                if (nextVoteTime - voteTime > streakWindow) {
                    break;
                }
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
        const prevVote = new Date(sortedVotes[i - 1]).getTime();
        const currVote = new Date(sortedVotes[i]).getTime();
        const timeDiff = currVote - prevVote;

        if (timeDiff <= streakWindow) {
            currentChain++;
        } else {
            bestStreak = Math.max(bestStreak, currentChain);
            currentChain = 1;
        }
    }

    bestStreak = Math.max(bestStreak, currentChain);

    return {currentStreak, bestStreak};
}

export default class MeCommand implements Command {
    data = {
        name: 'me',
        description: 'Show your vote statistics overview',
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
    };

    async execute(ctx: Context) {
        if (!ctx.isInGuild) {
            return ctx.reply({
                content: 'This command can only be used in a server.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await ctx.deferReply({
            flags: MessageFlags.Ephemeral,
        });

        const userId = ctx.user.id;
        const serverId = ctx.interaction.guild_id!;

        try {
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

            const recentVotes = await VoteModel.find({
                user_id: userId,
                server_id: serverId,
                is_test: false,
                createdAt: {$gte: threeMonthsAgo},
            }).sort({createdAt: -1});

            if (recentVotes.length === 0) {
                return ctx.editReply({
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: '# 📊 Your Vote Statistics',
                        },
                        {
                            type: ComponentType.Container,
                            accent_color: 15548997,
                            components: [
                                {
                                    type: ComponentType.TextDisplay,
                                    content: `## No Votes Yet\n\nYou haven't voted for any entity in this server in the last 3 months!\n\n> 💡 Use \`/setup\` to configure vote tracking and start earning rewards!`,
                                },
                            ],
                        },
                    ],
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                });
            }

            const settings = await SettingsModel.find({
                server_id: serverId,
                disabled: false,
            });

            const settingsMap = new Map(settings.map(s => [s.entity_id, s]));
            const voteTimes: Date[] = [];
            const entityStats = new Map<string, number>();
            const platformStats = new Map<string, number>();

            for (const vote of recentVotes) {
                const voteDate = new Date(vote.createdAt!);
                voteTimes.push(voteDate);

                const entityKey = `${vote.entity_type}_${vote.entity_id}`;
                entityStats.set(entityKey, (entityStats.get(entityKey) || 0) + 1);

                platformStats.set(vote.platform, (platformStats.get(vote.platform) || 0) + 1);
            }

            const {currentStreak, bestStreak} = calculateStreaks(voteTimes);

            const sortedTimes = voteTimes.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
            let totalGap = 0;
            let gapCount = 0;

            for (let i = 1; i < sortedTimes.length; i++) {
                const gap = new Date(sortedTimes[i]).getTime() - new Date(sortedTimes[i - 1]).getTime();
                totalGap += gap;
                gapCount++;
            }

            const avgGapMs = gapCount > 0 ? totalGap / gapCount : 0;
            const avgGapHours = avgGapMs / (1000 * 60 * 60);

            const topEntity = Array.from(entityStats.entries())
                .map(([key, count]) => {
                    const [entityType, entityId] = key.split('_');
                    const setting = settingsMap.get(entityId);

                    let entityName = entityType;
                    if (setting) {
                        if (entityType === 'bot') {
                            entityName = `<@${entityId}>`;
                        } else if (entityType === 'server') {
                            entityName = 'Server';
                        } else {
                            entityName = 'Game';
                        }
                    }

                    return {entityName, count};
                })
                .sort((a, b) => b.count - a.count)[0];

            const topPlatform = Array.from(platformStats.entries())
                .sort((a, b) => b[1] - a[1])[0];

            const components: MessageComponent[] = [
                {
                    type: ComponentType.TextDisplay,
                    content: '# 📊 Your Vote Overview',
                },
            ];

            const timeString = recentVotes[0].createdAt
                ? (() => {
                    const hoursAgo = Math.floor((Date.now() - new Date(recentVotes[0].createdAt).getTime()) / (1000 * 60 * 60));
                    return hoursAgo < 24
                        ? `⏰ **Last vote:** \`${hoursAgo}h ago\``
                        : `⏰ **Last vote:** \`${new Date(recentVotes[0].createdAt).toLocaleDateString()}\``;
                })()
                : null;

            components.push({
                type: ComponentType.Container,
                accent_color: 5763719,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `**📈 Last 3 Months:** \`${recentVotes.length}\` votes\n` +
                            `🔥 **Current Streak:** \`${currentStreak}\` | ⭐ **Best:** \`${bestStreak}\`\n` +
                            `⏱️ **Avg Between Votes:** ${formatTimeBetweenVotes(avgGapHours)}\n` +
                            (timeString || ''),
                    },
                ],
            });

            components.push({
                type: ComponentType.Separator,
                spacing: 1,
            });

            components.push({
                type: ComponentType.Container,
                accent_color: 3066993,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `## 💡 Quick Stats\n` +
                            `🏆 **Top Entity:** ${topEntity ? topEntity.entityName : 'N/A'} (\`${topEntity ? topEntity.count : 0}\` votes)\n` +
                            `🌐 **Top Platform:** ${topPlatform ? topPlatform[0] : 'N/A'} (\`${topPlatform ? topPlatform[1] : 0}\` votes)`,
                    },
                ],
            });

            components.push({
                type: ComponentType.Separator,
                spacing: 1,
            });

            components.push({
                type: ComponentType.Container,
                accent_color: 6387427,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `## 📂 Detailed Statistics\n\n` +
                            `Use the buttons below to view detailed breakdowns:\n` +
                            `• **Activity** - View voting patterns and streaks\n` +
                            `• **Platform** - Platform statistics\n` +
                            `• **Entities** - Entity breakdown`,
                    },
                ],
            });

            components.push({
                type: ComponentType.Separator,
                spacing: 1,
            });

            components.push({
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Primary,
                        disabled: true,
                        label: '📊 Overview',
                        custom_id: 'me_view_overview',
                    },
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Secondary,
                        label: '⏰ Activity',
                        custom_id: 'me_view_activity',
                    },
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Secondary,
                        label: '🌐 Platform',
                        custom_id: 'me_view_platform',
                    },
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Secondary,
                        label: '🎯 Entities',
                        custom_id: 'me_view_entities',
                    },
                ],
            });

            return ctx.editReply({
                components,
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        } catch (error) {
            Logger.error('Error in /me command: ' + error);

            return ctx.editReply({
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: '# ❌ Error',
                    },
                    {
                        type: ComponentType.Container,
                        accent_color: 15548997,
                        components: [
                            {
                                type: ComponentType.TextDisplay,
                                content: 'An error occurred while fetching your vote statistics. Please try again later.',
                            },
                        ],
                    },
                ],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        }
    }
}
