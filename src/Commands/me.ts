import {Context} from "@Utils/Context";
import {Command} from "@Types/Discord";
import {
    ApplicationIntegrationType,
    InteractionContextType,
    MessageFlags,
    ComponentType,
    APITextDisplayComponent,
    APIContainerComponent,
    APISeparatorComponent,
    APIMessageTopLevelComponent,
} from "discord-api-types/v10";
import VoteModel from "@Schemas/Vote";
import SettingsModel from "@Schemas/Settings";
import Logger from "@Utils/Logger";

type MessageComponent = APITextDisplayComponent | APIContainerComponent | APISeparatorComponent;

interface MeResponse {
    components: MessageComponent[];
}

interface UserVoteStats {
    totalVotes: number;
    threeMonthVotes: number;
    entityBreakdown: Array<{
        entityName: string;
        count: number;
    }>;
    platforms: Array<{
        platform: string;
        count: number;
    }>;
    currentStreak: number;
    bestStreak: number;
    avgTimeBetweenVotes: string;
    peakVotingHour: number;
    peakVotingWeekday: number;
    weekdayDistribution: number[];
    hourlyDistribution: number[];
    lastVote: Date | null;
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_EMOJIS = ['📅', '🌙', '🔥', '💪', '⚡', '🎉', '😴'];

function buildWeekdayBar(distribution: number[], maxCount: number): string {
    const maxBarLength = 10;

    return distribution.map((count, i) => {
        const percentage = maxCount > 0 ? count / maxCount : 0;
        const barLength = Math.round(percentage * maxBarLength);
        const bar = '█'.repeat(barLength) + '░'.repeat(maxBarLength - barLength);

        return `${WEEKDAY_EMOJIS[i]} **${WEEKDAY_NAMES[i].slice(0, 3)}** \`${count}\`\n${bar}`;
    }).join('\n');
}

function buildHourlyHeatmap(distribution: number[], maxCount: number): string {
    const blocks: string[] = [];
    for (let i = 0; i < 4; i++) {
        const startHour = i * 6;
        const blockVotes = distribution.slice(startHour, startHour + 6).reduce((a, b) => a + b, 0);
        const blockMax = Math.max(...distribution.slice(startHour, startHour + 6));
        const intensity = maxCount > 0 ? Math.round((blockMax / maxCount) * 3) : 0;
        const intensityChars = ['░', '▒', '▓', '█'];
        const timeLabel = startHour === 0 ? '🌙 12AM-6AM' :
                          startHour === 6 ? '🌅 6AM-12PM' :
                          startHour === 12 ? '☀️ 12PM-6PM' :
                          '🌆 6PM-12AM';

        blocks.push(`${timeLabel} \`${blockVotes}\` ${intensityChars[intensity]}`);
    }

    return blocks.join('\n');
}

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

function formatHour(hour: number): string {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';

    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

function buildVoteStatsComponents(stats: UserVoteStats): MeResponse {
    const components: MessageComponent[] = [
        {
            type: ComponentType.TextDisplay,
            content: '# 📊 Your Voting Patterns',
        },
    ];

    let timeString: Nullable<string> = null;
    if (stats.lastVote) {
        const hoursAgo = Math.floor((Date.now() - new Date(stats.lastVote).getTime()) / (1000 * 60 * 60));

        timeString = hoursAgo < 24
            ? `⏰ **Last vote:** \`${hoursAgo}h ago\``
            : `⏰ **Last vote:** \`${new Date(stats.lastVote).toLocaleDateString()}\``;
    }


    components.push({
        type: ComponentType.Container,
        accent_color: 5763719,
        components: [
            {
                type: ComponentType.TextDisplay,
                content: `**📈 Last 3 Months:** \`${stats.threeMonthVotes}\` votes total\n` +
                         `🔥 **Current Streak:** \`${stats.currentStreak}\` votes | ⭐ **Best:** \`${stats.bestStreak}\`\n` +
                         `⏱️ **Avg Between Votes:** ${formatTimeBetweenVotes(parseFloat(stats.avgTimeBetweenVotes))}\n` +
                (timeString ? timeString : ''),
            },
        ],
    });

    const maxWeekdayCount = Math.max(...stats.weekdayDistribution);
    const hasWeekdayData = maxWeekdayCount > 0;

    components.push({
        type: ComponentType.Separator,
        spacing: 1,
    });

    components.push({
        type: ComponentType.Container,
        accent_color: 3056991,
        components: [
            {
                type: ComponentType.TextDisplay,
                content: `## 🕐 Peak Voting Time\n` +
                         `📅 **Busiest Day:** ${WEEKDAY_EMOJIS[stats.peakVotingWeekday]} ${WEEKDAY_NAMES[stats.peakVotingWeekday]}\n` +
                         `⌚ **Busiest Hour:** \`${formatHour(stats.peakVotingHour)}\``,
            },
        ],
    });

    if (hasWeekdayData && stats.threeMonthVotes > 0) {
        components.push({
            type: ComponentType.Container,
            accent_color: 5793266,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `### 📊 Weekly Distribution\n${buildWeekdayBar(stats.weekdayDistribution, maxWeekdayCount)}`,
                },
            ],
        });
    }

    const maxHourlyCount = Math.max(...stats.hourlyDistribution);
    if (maxHourlyCount > 0 && stats.threeMonthVotes > 0) {
        components.push({
            type: ComponentType.Container,
            accent_color: 5793266,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `### ⏰ Daily Activity\n${buildHourlyHeatmap(stats.hourlyDistribution, maxHourlyCount)}`,
                },
            ],
        });
    }

    if (stats.platforms.length > 0) {
        components.push({
            type: ComponentType.Separator,
            spacing: 1,
        });

        const platformRows = stats.platforms.map(p => {
            const percentage = stats.threeMonthVotes > 0 ? Math.round((p.count / stats.threeMonthVotes) * 100) : 0;
            return `• **${p.platform}:** \`${p.count}\` votes (\`${percentage}%\`)`;
        });

        components.push({
            type: ComponentType.Container,
            accent_color: 3066993,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `## 🌐 By Platform\n${platformRows.join('\n')}`,
                },
            ],
        });
    }

    if (stats.entityBreakdown.length > 0) {
        components.push({
            type: ComponentType.Separator,
            spacing: 1,
        });

        const topEntities = stats.entityBreakdown.slice(0, 5);
        const entityRows = topEntities.map((entity, index) => {
            const medals = ['🥇', '🥈', '🥉', '4.', '5.'];

            return `${medals[index]} **${entity.entityName}:** \`${entity.count}\` votes`;
        });

        let entityContent = `## 🎯 Top Entities\n${entityRows.join('\n')}`;

        if (stats.entityBreakdown.length > 5) {
            entityContent += `\n• ... and \`${stats.entityBreakdown.length - 5}\` more`;
        }

        components.push({
            type: ComponentType.Container,
            accent_color: 16755200,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: entityContent,
                },
            ],
        });
    }

    return {components};
}

function buildNoVotesComponents(): MeResponse {
    return {
        components: [
            {
                type: ComponentType.TextDisplay,
                content: '# 📊 Your Voting Patterns',
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
    };
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

    return { currentStreak, bestStreak };
}

export default class MeCommand implements Command {
    data = {
        name: 'me',
        description: 'Show your advanced voting statistics and patterns',
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
                    ...buildNoVotesComponents(),
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                });
            }

            const settings = await SettingsModel.find({
                server_id: serverId,
                disabled: false,
            });

            const settingsMap = new Map(settings.map(s => [s.entity_id, s]));

            const weekdayDistribution = new Array(7).fill(0);
            const hourlyDistribution = new Array(24).fill(0);
            const entityStats = new Map<string, number>();
            const platformStats = new Map<string, number>();
            const voteTimes: Date[] = [];

            for (const vote of recentVotes) {
                const voteDate = new Date(vote.createdAt!);
                voteTimes.push(voteDate);

                const weekday = voteDate.getDay();
                weekdayDistribution[weekday]++;

                const hour = voteDate.getHours();
                hourlyDistribution[hour]++;

                const entityKey = `${vote.entity_type}_${vote.entity_id}`;
                entityStats.set(entityKey, (entityStats.get(entityKey) || 0) + 1);

                platformStats.set(vote.platform, (platformStats.get(vote.platform) || 0) + 1);
            }

            const { currentStreak, bestStreak } = calculateStreaks(voteTimes);

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

            const peakWeekdayIndex = weekdayDistribution.indexOf(Math.max(...weekdayDistribution));
            const peakHourIndex = hourlyDistribution.indexOf(Math.max(...hourlyDistribution));

            const entityBreakdown = Array.from(entityStats.entries())
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

                    return { entityName, count };
                })
                .sort((a, b) => b.count - a.count);

            const platforms = Array.from(platformStats.entries())
                .map(([platform, count]) => ({ platform, count }))
                .sort((a, b) => b.count - a.count);

            const stats: UserVoteStats = {
                totalVotes: recentVotes.length,
                threeMonthVotes: recentVotes.length,
                entityBreakdown,
                platforms,
                currentStreak,
                bestStreak,
                avgTimeBetweenVotes: avgGapHours.toString(),
                peakVotingHour: peakHourIndex,
                peakVotingWeekday: peakWeekdayIndex,
                weekdayDistribution,
                hourlyDistribution,
                lastVote: recentVotes[0].createdAt,
            };

            return ctx.editReply({
                ...buildVoteStatsComponents(stats),
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
