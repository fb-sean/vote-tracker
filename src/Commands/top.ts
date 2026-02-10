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
    APIApplicationCommandIntegerOption,
    APIApplicationCommandStringOption,
} from "discord-api-types/v10";
import VoteModel from "@Schemas/Vote";
import SettingsModel from "@Schemas/Settings";
import Logger from "@Utils/Logger";

type MessageComponent = APITextDisplayComponent | APIContainerComponent | APISeparatorComponent;

interface TopResponse {
    components: MessageComponent[];
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

async function getActivityData(ctx: Context, months?: number): Promise<TopResponse | null> {
    const serverId = ctx.interaction.guild_id!;
    const userId = ctx.user.id;
    const monthsToCheck = months || 3;

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - monthsToCheck);

    const recentVotes = await VoteModel.find({
        user_id: userId,
        server_id: serverId,
        is_test: false,
        createdAt: {$gte: threeMonthsAgo},
    }).sort({createdAt: -1});

    if (recentVotes.length === 0) {
        return null;
    }

    const weekdayDistribution = new Array(7).fill(0);
    const hourlyDistribution = new Array(24).fill(0);
    const voteTimes: Date[] = [];

    for (const vote of recentVotes) {
        const voteDate = new Date(vote.createdAt!);
        voteTimes.push(voteDate);

        const weekday = voteDate.getDay();
        weekdayDistribution[weekday]++;

        const hour = voteDate.getHours();
        hourlyDistribution[hour]++;
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

    const peakWeekdayIndex = weekdayDistribution.indexOf(Math.max(...weekdayDistribution));
    const peakHourIndex = hourlyDistribution.indexOf(Math.max(...hourlyDistribution));

    const components: MessageComponent[] = [
        {
            type: ComponentType.TextDisplay,
            content: `# ⏰ Voting Activity`,
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
                content: `**📈 Last ${monthsToCheck} Month${monthsToCheck > 1 ? 's' : ''}:** \`${recentVotes.length}\` votes\n` +
                    `🔥 **Current Streak:** \`${currentStreak}\` votes | ⭐ **Best:** \`${bestStreak}\`\n` +
                    `⏱️ **Avg Between Votes:** ${formatTimeBetweenVotes(avgGapHours)}\n` +
                    (timeString || ''),
            },
        ],
    });

    const maxWeekdayCount = Math.max(...weekdayDistribution);
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
                    `📅 **Busiest Day:** ${WEEKDAY_EMOJIS[peakWeekdayIndex]} ${WEEKDAY_NAMES[peakWeekdayIndex]}\n` +
                    `⌚ **Busiest Hour:** \`${formatHour(peakHourIndex)}\``,
            },
        ],
    });

    if (hasWeekdayData && recentVotes.length > 0) {
        components.push({
            type: ComponentType.Container,
            accent_color: 5793266,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `### 📊 Weekly Distribution\n${buildWeekdayBar(weekdayDistribution, maxWeekdayCount)}`,
                },
            ],
        });
    }

    const maxHourlyCount = Math.max(...hourlyDistribution);
    if (maxHourlyCount > 0 && recentVotes.length > 0) {
        components.push({
            type: ComponentType.Container,
            accent_color: 5793266,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `### ⏰ Daily Activity\n${buildHourlyHeatmap(hourlyDistribution, maxHourlyCount)}`,
                },
            ],
        });
    }

    return {components};
}

async function getPlatformData(ctx: Context, months?: number): Promise<TopResponse | null> {
    const serverId = ctx.interaction.guild_id!;
    const userId = ctx.user.id;
    const monthsToCheck = months || 3;

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - monthsToCheck);

    const recentVotes = await VoteModel.find({
        user_id: userId,
        server_id: serverId,
        is_test: false,
        createdAt: {$gte: threeMonthsAgo},
    }).sort({createdAt: -1});

    if (recentVotes.length === 0) {
        return null;
    }

    const platformStats = new Map<string, number>();

    for (const vote of recentVotes) {
        platformStats.set(vote.platform, (platformStats.get(vote.platform) || 0) + 1);
    }

    const platforms = Array.from(platformStats.entries())
        .map(([platform, count]) => ({platform, count}))
        .sort((a, b) => b.count - a.count);

    const components: MessageComponent[] = [
        {
            type: ComponentType.TextDisplay,
            content: `# 🌐 Platform Statistics`,
        },
        {
            type: ComponentType.Container,
            accent_color: 5763719,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `**📈 Last ${monthsToCheck} Month${monthsToCheck > 1 ? 's' : ''}:** \`${recentVotes.length}\` total votes\n` +
                        `**Platforms Used:** \`${platforms.length}\``,
                },
            ],
        },
    ];

    components.push({
        type: ComponentType.Separator,
        spacing: 1,
    });

    for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        const percentage = recentVotes.length > 0 ? Math.round((p.count / recentVotes.length) * 100) : 0;
        const barLength = Math.round((percentage / 100) * 15);
        const bar = '█'.repeat(barLength);

        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;

        components.push({
            type: ComponentType.Container,
            accent_color: i === 0 ? 16755200 : i === 1 ? 11403763 : i === 2 ? 5793266 : 5763719,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `${medal} **${p.platform}**\n\`${p.count}\` votes (\`${percentage}%\`) ${bar}`,
                },
            ],
        });
    }

    return {components};
}

async function getEntitiesData(ctx: Context, months?: number): Promise<TopResponse | null> {
    const serverId = ctx.interaction.guild_id!;
    const userId = ctx.user.id;
    const monthsToCheck = months || 3;

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - monthsToCheck);

    const recentVotes = await VoteModel.find({
        user_id: userId,
        server_id: serverId,
        is_test: false,
        createdAt: {$gte: threeMonthsAgo},
    }).sort({createdAt: -1});

    if (recentVotes.length === 0) {
        return null;
    }

    const settings = await SettingsModel.find({
        server_id: serverId,
        disabled: false,
    });

    const settingsMap = new Map(settings.map(s => [s.entity_id, s]));
    const entityStats = new Map<string, number>();

    for (const vote of recentVotes) {
        const entityKey = `${vote.entity_type}_${vote.entity_id}`;
        entityStats.set(entityKey, (entityStats.get(entityKey) || 0) + 1);
    }

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

            return {entityName, count, entityType};
        })
        .sort((a, b) => b.count - a.count);

    const components: MessageComponent[] = [
        {
            type: ComponentType.TextDisplay,
            content: `# 🎯 Entity Statistics`,
        },
        {
            type: ComponentType.Container,
            accent_color: 5763719,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `**📈 Last ${monthsToCheck} Month${monthsToCheck > 1 ? 's' : ''}:** \`${recentVotes.length}\` total votes\n` +
                        `**Entities Voted:** \`${entityBreakdown.length}\``,
                },
            ],
        },
    ];

    components.push({
        type: ComponentType.Separator,
        spacing: 1,
    });

    for (let i = 0; i < Math.min(entityBreakdown.length, 15); i++) {
        const entity = entityBreakdown[i];
        const percentage = recentVotes.length > 0 ? Math.round((entity.count / recentVotes.length) * 100) : 0;
        const barLength = Math.round((percentage / 100) * 15);
        const bar = '█'.repeat(barLength);

        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const typeIcon = entity.entityType === 'bot' ? '🤖' : entity.entityType === 'game' ? '🎮' : '🖥️';

        components.push({
            type: ComponentType.Container,
            accent_color: i === 0 ? 16755200 : i === 1 ? 11403763 : i === 2 ? 5793266 : 5763719,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `${medal} ${typeIcon} **${entity.entityName}**\n\`${entity.count}\` votes (\`${percentage}%\`) ${bar}`,
                },
            ],
        });
    }

    if (entityBreakdown.length > 15) {
        components.push({
            type: ComponentType.TextDisplay,
            content: `... and \`${entityBreakdown.length - 15}\` more entities`,
        });
    }

    return {components};
}

function buildNoVotesComponents(subcommand: string): TopResponse {
    const messages = {
        activity: 'voting activity data',
        platform: 'platform statistics',
        entities: 'entity statistics',
    };

    return {
        components: [
            {
                type: ComponentType.TextDisplay,
                content: `# 📊 No Data Found`,
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

export default class TopCommand implements Command {
    data = {
        name: 'top',
        description: 'View your voting statistics',
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
        options: [
            {
                name: 'activity',
                description: 'View your voting activity patterns and streaks',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'months',
                        description: 'Number of months to look back (default: 3)',
                        type: 4, // INTEGER
                        min_value: 1,
                        max_value: 12,
                    } as APIApplicationCommandIntegerOption,
                ],
            },
            {
                name: 'platform',
                description: 'View your platform voting statistics',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'months',
                        description: 'Number of months to look back (default: 3)',
                        type: 4, // INTEGER
                        min_value: 1,
                        max_value: 12,
                    } as APIApplicationCommandIntegerOption,
                ],
            },
            {
                name: 'entities',
                description: 'View your entity voting statistics',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'months',
                        description: 'Number of months to look back (default: 3)',
                        type: 4, // INTEGER
                        min_value: 1,
                        max_value: 12,
                    } as APIApplicationCommandIntegerOption,
                ],
            },
        ],
    };

    async execute(ctx: Context, additional?: Record<string, any>) {
        if (!ctx.isInGuild) {
            return ctx.reply({
                content: 'This command can only be used in a server.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await ctx.deferReply({
            flags: MessageFlags.Ephemeral,
        });

        try {
            const options = (ctx.interaction.data as any)?.options;
            if (!options || options.length === 0) {
                return ctx.editReply({
                    content: 'Please select a subcommand: activity, platform, or entities.',
                });
            }

            const subcommand = options[0];
            const subcommandName = subcommand.name;
            const subcommandOptions = subcommand.options || [];
            const monthsOption = subcommandOptions.find((o: any) => o.name === 'months');
            const months = monthsOption ? monthsOption.value : 3;

            let data: TopResponse | null = null;

            switch (subcommandName) {
                case 'activity':
                    data = await getActivityData(ctx, months);
                    break;
                case 'platform':
                    data = await getPlatformData(ctx, months);
                    break;
                case 'entities':
                    data = await getEntitiesData(ctx, months);
                    break;
            }

            if (!data) {
                return ctx.editReply({
                    ...buildNoVotesComponents(subcommandName),
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                });
            }

            return ctx.editReply({
                ...data,
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        } catch (error) {
            Logger.error('Error in /top command: ' + error);

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
                                content: 'An error occurred while fetching your statistics. Please try again later.',
                            },
                        ],
                    },
                ],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        }
    }
}
