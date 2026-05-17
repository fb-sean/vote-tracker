import {Context} from "@Utils/Context";
import {Command} from "@Types/Discord";
import {
    ApplicationIntegrationType,
    InteractionContextType,
    MessageFlags,
    APIApplicationCommandOptionChoice,
    ComponentType,
    RESTPostAPIChannelMessageJSONBody,
    APITextDisplayComponent,
    APIContainerComponent,
    APISeparatorComponent,
} from "discord-api-types/v10";
import VoteModel from "@Schemas/Vote";
import SettingsModel from "@Schemas/Settings";

type LeaderboardSort = 'votes' | 'streak' | 'best_streak';

type MessageComponent = APITextDisplayComponent | APIContainerComponent | APISeparatorComponent;

interface LeaderboardResponse extends RESTPostAPIChannelMessageJSONBody {
    components: MessageComponent[];
}

interface LeaderboardEntry {
    userId: string;
    count: number;
    streak: number;
    bestStreak: number;
    lastVote: Date | null;
}

function buildLeaderboardComponents(
    topUsers: LeaderboardEntry[],
    sortedUsers: LeaderboardEntry[],
    entityName: string,
    sort: LeaderboardSort,
    userStats: Map<string, LeaderboardEntry>,
    currentUserId: string
): LeaderboardResponse {
    const components: MessageComponent[] = [
        {
            type: ComponentType.TextDisplay,
            content: '# 🏆 Vote Leaderboard',
        },
    ];

    const sortNames = {
        votes: 'Total Votes',
        streak: 'Current Streak',
        best_streak: 'Best Streak',
    };
    const sortColors = {
        votes: 5763719, // Blue
        streak: 3066993, // Green
        best_streak: 3056991, // Purple
    };

    components.push({
        type: ComponentType.Container,
        accent_color: sortColors[sort],
        components: [
            {
                type: ComponentType.TextDisplay,
                content: `**Entity:** ${entityName}\n**Sort:** ${sortNames[sort]}\n**Total Voters:** \`${userStats.size}\``,
            },
        ],
    });

    components.push({
        type: ComponentType.Separator,
        spacing: 1,
    });

    if (topUsers.length >= 3) {
        const gold = topUsers[0];
        const silver = topUsers[1];
        const bronze = topUsers[2];

        components.push({
            type: ComponentType.Container,
            accent_color: 3158063,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `🥇 <@${gold.userId}> — \`${gold.count}\` votes${gold.userId === currentUserId ? ' ← **You!**' : ''}`,
                },
            ],
        });

        components.push({
            type: ComponentType.Container,
            accent_color: 11264767,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `🥈 <@${silver.userId}> — \`${silver.count}\` votes${silver.userId === currentUserId ? ' ← **You!**' : ''}`,
                },
            ],
        });

        components.push({
            type: ComponentType.Container,
            accent_color: 9935630,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `🥉 <@${bronze.userId}> — \`${bronze.count}\` votes${bronze.userId === currentUserId ? ' ← **You!**' : ''}`,
                },
            ],
        });

        if (topUsers.length > 3) {
            components.push({
                type: ComponentType.Separator,
                spacing: 1,
            });

            for (let i = 3; i < Math.min(topUsers.length, 10); i++) {
                const user = topUsers[i];
                components.push({
                    type: ComponentType.TextDisplay,
                    content: `**#${i + 1}** <@${user.userId}> — \`${user.count}\` votes${user.userId === currentUserId ? ' ← **You!**' : ''}`,
                });
            }

            if (topUsers.length > 10) {
                components.push({
                    type: ComponentType.TextDisplay,
                    content: `... and \`${topUsers.length - 10}\` more`,
                });
            }
        }
    } else if (topUsers.length > 0) {
        for (let i = 0; i < Math.min(topUsers.length, 10); i++) {
            const user = topUsers[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
            components.push({
                type: ComponentType.TextDisplay,
                content: `${medal} <@${user.userId}> — \`${user.count}\` votes${user.userId === currentUserId ? ' ← **You!**' : ''}`,
            });
        }
    }

    const userRank = sortedUsers.findIndex(u => u.userId === currentUserId);
    if (userRank >= 25) {
        components.push({
            type: ComponentType.Separator,
            spacing: 1,
        });

        const user = sortedUsers[userRank];
        components.push({
            type: ComponentType.Container,
            accent_color: 15548997, // Orange
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `**Your Rank:** #${userRank + 1}\n<@${currentUserId}> — \`${user.count}\` votes`,
                },
            ],
        });
    } else if (userRank === -1) {
        components.push({
            type: ComponentType.Separator,
            spacing: 1,
        });

        components.push({
            type: ComponentType.Container,
            accent_color: 15548997,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: '> 💡 You haven\'t voted for this entity yet! Be the first to earn rewards.',
                },
            ],
        });
    }

    return {components};
}

function buildNoVotesComponents(): LeaderboardResponse {
    return {
        components: [
            {
                type: ComponentType.TextDisplay,
                content: '# 🏆 Vote Leaderboard',
            },
            {
                type: ComponentType.Container,
                accent_color: 15548997,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: '## No Votes Yet\n\nNo votes found! Be the first to vote and claim your spot on the leaderboard.',
                    },
                ],
            },
        ],
    };
}

function buildNoSetupComponents(): LeaderboardResponse {
    return {
        components: [
            {
                type: ComponentType.TextDisplay,
                content: '# 🏆 Vote Leaderboard',
            },
            {
                type: ComponentType.Container,
                accent_color: 15548997,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: '## No Active Setups\n\nNo active vote tracking setups found in this server.\n\n> 💡 Use `/setup` to create one and start tracking votes!',
                    },
                ],
            },
        ],
    };
}

export default class LeaderboardCommand implements Command {
    data = {
        name: 'leaderboard',
        description: 'Show the vote leaderboard',
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
        options: [
            {
                name: 'entity',
                description: 'Filter by specific entity (default: all)',
                type: 3, // STRING
                required: false,
                autocomplete: true,
            },
            {
                name: 'sort',
                description: 'Sort by',
                type: 3, // STRING
                required: false,
                choices: [
                    {name: 'Total Votes', value: 'votes'},
                    {name: 'Current Streak', value: 'streak'},
                    {name: 'Best Streak', value: 'best_streak'},
                ],
            },
        ],
    };

    async execute(ctx: Context) {
        if (!ctx.isInGuild) {
            return ctx.reply({
                content: 'This command can only be used in a server.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const serverId = ctx.interaction.guild_id!;
        const entityId = ctx.getOptionValue('entity');
        const sort: LeaderboardSort = ctx.getOptionValue<LeaderboardSort>('sort') || 'votes';

        try {
            const settings = await SettingsModel.find({
                server_id: serverId,
                disabled: false,
            });

            if (settings.length === 0) {
                return ctx.reply({
                    ...buildNoSetupComponents(),
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                });
            }

            const entityIds = entityId
                ? settings.filter(s => s.entity_id === entityId).map(s => s.entity_id)
                : settings.map(s => s.entity_id);

            if (entityIds.length === 0) {
                return ctx.reply({
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: '# 🏆 Vote Leaderboard',
                        },
                        {
                            type: ComponentType.Container,
                            accent_color: 15548997,
                            components: [
                                {
                                    type: ComponentType.TextDisplay,
                                    content: '## Entity Not Found\n\nThe specified entity is not enabled for vote tracking.',
                                },
                            ],
                        },
                    ],
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                } as LeaderboardResponse);
            }

            const votes = await VoteModel.find({
                server_id: serverId,
                entity_id: {$in: entityIds},
                is_test: false,
            }).sort({createdAt: 1});

            if (votes.length === 0) {
                return ctx.reply({
                    ...buildNoVotesComponents(),
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                });
            }

            const userStats = new Map<string, LeaderboardEntry>();

            for (const vote of votes) {
                if (!userStats.has(vote.user_id)) {
                    userStats.set(vote.user_id, {
                        userId: vote.user_id,
                        count: 0,
                        streak: 0,
                        bestStreak: 0,
                        lastVote: null,
                    });
                }

                const stat = userStats.get(vote.user_id)!;
                stat.count++;
                stat.lastVote = vote.createdAt!;
            }

            for (const [userId, stat] of userStats) {
                const userVotes = votes.filter(v => v.user_id === userId).sort((a, b) =>
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );

                let currentStreak = 0;
                let streakCheckTime = Date.now();
                const streakWindow = 48 * 60 * 60 * 1000;

                for (let i = userVotes.length - 1; i >= 0; i--) {
                    const vote = userVotes[i];
                    const voteTime = new Date(vote.createdAt).getTime();

                    if (streakCheckTime - voteTime > streakWindow) {
                        if (i < userVotes.length - 1) {
                            const nextVote = userVotes[i + 1];
                            const nextVoteTime = new Date(nextVote.createdAt).getTime();

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

                stat.streak = currentStreak;

                let bestStreak = 1;
                let currentChain = 1;

                for (let i = 1; i < userVotes.length; i++) {
                    const prevVote = userVotes[i - 1];
                    const currVote = userVotes[i];
                    const timeDiff = new Date(currVote.createdAt).getTime() - new Date(prevVote.createdAt).getTime();

                    if (timeDiff <= streakWindow) {
                        currentChain++;
                    } else {
                        bestStreak = Math.max(bestStreak, currentChain);
                        currentChain = 1;
                    }
                }

                stat.bestStreak = Math.max(bestStreak, currentChain);
            }

            const sortedUsers = Array.from(userStats.values()).sort((a, b) => {
                if (sort === 'votes') return b.count - a.count;
                if (sort === 'streak') return b.streak - a.streak;
                if (sort === 'best_streak') return b.bestStreak - b.bestStreak;

                return 0;
            });

            const topUsers = sortedUsers.slice(0, 25);

            const entityName = entityId
                ? settings.find(s => s.entity_id === entityId)?.entity_type === 'bot'
                    ? `<@${entityId}>`
                    : settings.find(s => s.entity_id === entityId)?.entity_type === 'game'
                        ? 'Game'
                        : 'Server'
                : 'All Entities';

            return ctx.reply({
                ...buildLeaderboardComponents(topUsers, sortedUsers, entityName, sort, userStats, ctx.user.id),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        } catch (error) {
            console.error('Error in /leaderboard command:', error);

            return ctx.reply({
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
                                content: 'An error occurred while fetching the leaderboard.',
                            },
                        ],
                    },
                ],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            } as LeaderboardResponse);
        }
    }

    async autocomplete(ctx: Context) {
        if (!ctx.isInGuild) {
            return ctx.autocomplete([]);
        }

        const serverId = ctx.interaction.guild_id!;

        try {
            const settings = await SettingsModel.find({
                server_id: serverId,
                disabled: false,
            });

            const choices: APIApplicationCommandOptionChoice[] = [];

            for (const setting of settings) {
                const entityId = setting.entity_id || '';
                let name = '';

                if (setting.entity_type === 'bot') {
                    name = `Bot: ${entityId}`;
                } else if (setting.entity_type === 'server') {
                    name = `This Server`;
                } else {
                    name = `Game: ${entityId}`;
                }

                choices.push({name, value: entityId});
            }

            return ctx.autocomplete(choices.slice(0, 25));
        } catch (error) {
            console.error('Error in leaderboard autocomplete:', error);

            return ctx.autocomplete([]);
        }
    }
}
