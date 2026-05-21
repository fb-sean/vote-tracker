import {Context} from "@Utils/Context";
import {ButtonStyle, ComponentType, MessageFlags} from "discord-api-types/v10";
import VoteModel from "@Schemas/Vote";
import SettingsModel from "@Schemas/Settings";
import StreakService from "../Utils/StreakService";
import Logger from "@Utils/Logger";

type MessageComponent = any;

interface MeResponse {
    components: MessageComponent[];
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_EMOJIS = ['📅', '🌙', '🔥', '💪', '⚡', '🎉', '😴'];

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

function buildWeekdayBar(distribution: number[], maxCount: number): string {
    const maxBarLength = 10;

    return distribution.map((count, i) => {
        const percentage = maxCount > 0 ? count / maxCount : 0;
        const barLength = Math.min(Math.round(percentage * maxBarLength), maxBarLength);
        const bar = '█'.repeat(barLength) + '░'.repeat(maxBarLength - barLength);

        return `${WEEKDAY_EMOJIS[i]} **${WEEKDAY_NAMES[i].slice(0, 3)}** \`${count}\`\n${bar}`;
    }).join('\n');
}

function buildHourlyHeatmap(distribution: number[]): string {
    const maxBarLength = 15;
    const blocks: string[] = [];

    const blockCounts: number[] = [];
    for (let i = 0; i < 4; i++) {
        const startHour = i * 6;
        const blockVotes = distribution.slice(startHour, startHour + 6).reduce((a, b) => a + b, 0);
        blockCounts.push(blockVotes);
    }

    const maxBlockCount = Math.max(...blockCounts);

    for (let i = 0; i < 4; i++) {
        const startHour = i * 6;
        const blockVotes = blockCounts[i];
        const percentage = maxBlockCount > 0 ? blockVotes / maxBlockCount : 0;
        const barLength = Math.min(Math.round(percentage * maxBarLength), maxBarLength);
        const bar = '█'.repeat(barLength) + '░'.repeat(maxBarLength - barLength);
        const timeLabel = startHour === 0 ? '🌙 12AM-6AM' :
            startHour === 6 ? '🌅 6AM-12PM' :
                startHour === 12 ? '☀️ 12PM-6PM' :
                    '🌆 6PM-12AM';

        blocks.push(`${timeLabel} \`${blockVotes}\`\n${bar}`);
    }

    return blocks.join('\n');
}

function formatHour(hour: number): string {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';

    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

async function getOverviewData(ctx: Context): Promise<MeResponse> {
    const userId = ctx.user.id;
    const serverId = ctx.interaction.guild_id!;

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentVotes = await VoteModel.find({
        user_id: userId,
        server_id: serverId,
        is_test: false,
        createdAt: {$gte: threeMonthsAgo},
    }).sort({createdAt: -1});

    if (recentVotes.length === 0) {
        return {
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
        };
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

    const entityRefs = settings
        .filter(s => s.entity_id && s.entity_type)
        .map(s => ({ entityId: s.entity_id!, entityType: s.entity_type! }));
    const serverStreak = await StreakService.getAggregatedEntityStreak(userId, entityRefs);

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
                    `🔥 **Current Streak:** \`${serverStreak.current}\` | ⭐ **Best:** \`${serverStreak.best}\`\n` +
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

    return {components};
}

async function getActivityData(ctx: Context): Promise<MeResponse> {
    const userId = ctx.user.id;
    const serverId = ctx.interaction.guild_id!;

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentVotes = await VoteModel.find({
        user_id: userId,
        server_id: serverId,
        is_test: false,
        createdAt: {$gte: threeMonthsAgo},
    }).sort({createdAt: -1});

    if (recentVotes.length === 0) {
        return {
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: '# 📊 No Data Found',
                },
                {
                    type: ComponentType.Container,
                    accent_color: 15548997,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: `## No Votes Yet\n\nYou haven't voted for any entity in this server in the last 3 months!`,
                        },
                    ],
                },
            ],
        };
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

    const settings = await SettingsModel.find({
        server_id: serverId,
        disabled: false,
    });

    const entityRefs = settings
        .filter(s => s.entity_id && s.entity_type)
        .map(s => ({ entityId: s.entity_id!, entityType: s.entity_type! }));
    const serverStreak = await StreakService.getAggregatedEntityStreak(userId, entityRefs);

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
                content: `**📈 Last 3 Months:** \`${recentVotes.length}\` votes\n` +
                    `🔥 **Current Streak:** \`${serverStreak.current}\` votes | ⭐ **Best:** \`${serverStreak.best}\`\n` +
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

    if (recentVotes.length > 0) {
        components.push({
            type: ComponentType.Container,
            accent_color: 5793266,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `### ⏰ Daily Activity\n${buildHourlyHeatmap(hourlyDistribution)}`,
                },
            ],
        });
    }

    return {components};
}

async function getPlatformData(ctx: Context): Promise<MeResponse> {
    const userId = ctx.user.id;
    const serverId = ctx.interaction.guild_id!;

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentVotes = await VoteModel.find({
        user_id: userId,
        server_id: serverId,
        is_test: false,
        createdAt: {$gte: threeMonthsAgo},
    }).sort({createdAt: -1});

    if (recentVotes.length === 0) {
        return {
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: '# 📊 No Data Found',
                },
                {
                    type: ComponentType.Container,
                    accent_color: 15548997,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: `## No Votes Yet\n\nYou haven't voted for any entity in this server in the last 3 months!`,
                        },
                    ],
                },
            ],
        };
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
                    content: `**📈 Last 3 Months:** \`${recentVotes.length}\` total votes\n` +
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
        const bar = '█'.repeat(barLength) + '░'.repeat(15 - barLength);

        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;

        components.push({
            type: ComponentType.Container,
            accent_color: i === 0 ? 16755200 : i === 1 ? 11403763 : i === 2 ? 5793266 : 5763719,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `${medal} **${p.platform}**\n\`${p.count}\` votes (\`${percentage}%\`)\n${bar}`,
                },
            ],
        });
    }

    return {components};
}

async function getEntitiesData(ctx: Context): Promise<MeResponse> {
    const userId = ctx.user.id;
    const serverId = ctx.interaction.guild_id!;

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentVotes = await VoteModel.find({
        user_id: userId,
        server_id: serverId,
        is_test: false,
        createdAt: {$gte: threeMonthsAgo},
    }).sort({createdAt: -1});

    if (recentVotes.length === 0) {
        return {
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: '# 📊 No Data Found',
                },
                {
                    type: ComponentType.Container,
                    accent_color: 15548997,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: `## No Votes Yet\n\nYou haven't voted for any entity in this server in the last 3 months!`,
                        },
                    ],
                },
            ],
        };
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
                    content: `**📈 Last 3 Months:** \`${recentVotes.length}\` total votes\n` +
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
        const bar = '█'.repeat(barLength) + '░'.repeat(15 - barLength);

        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const typeIcon = entity.entityType === 'bot' ? '🤖' : entity.entityType === 'game' ? '🎮' : '🖥️';

        components.push({
            type: ComponentType.Container,
            accent_color: i === 0 ? 16755200 : i === 1 ? 11403763 : i === 2 ? 5793266 : 5763719,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `${medal} ${typeIcon} **${entity.entityName}**\n\`${entity.count}\` votes (\`${percentage}%\`)\n${bar}`,
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

function buildNavigationButtons(activeView: string): any[] {
    const views = ['overview', 'activity', 'platform', 'entities'];
    const viewLabels = {
        overview: '📊 Overview',
        activity: '⏰ Activity',
        platform: '🌐 Platform',
        entities: '🎯 Entities',
    };

    return views.map(view => ({
        type: ComponentType.Button,
        style: view === activeView ? ButtonStyle.Primary : ButtonStyle.Secondary,
        disabled: view === activeView,
        label: viewLabels[view],
        custom_id: `me_view_${view}`,
    }));
}

export async function handleMeView(ctx: Context, view: string) {
    try {
        await ctx.deferUpdate();

        let data: MeResponse;

        switch (view) {
            case 'activity':
                data = await getActivityData(ctx);
                break;
            case 'platform':
                data = await getPlatformData(ctx);
                break;
            case 'entities':
                data = await getEntitiesData(ctx);
                break;
            case 'overview':
            default:
                data = await getOverviewData(ctx);
                break;
        }

        const components = [
            ...data.components,
            {
                type: ComponentType.Separator,
                spacing: 1,
            },
            {
                type: ComponentType.ActionRow,
                components: buildNavigationButtons(view),
            },
        ];

        return ctx.editReply({
            components,
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
    } catch (error) {
        Logger.error(`Error handling me view ${view}: ${error}`);

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
