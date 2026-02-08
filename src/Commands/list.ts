import {Context} from "@Utils/Context";
import {Command} from "@Types/Discord";
import {ApplicationIntegrationType, InteractionContextType, MessageFlags,} from "discord-api-types/v10";
import {buildSetupList, getAllSetupsForServer} from "@Utils/SetupManager";

export default class ListCommand implements Command {
    data = {
        name: 'list',
        description: 'List all vote tracking setups for this server',
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
    };

    async execute(ctx: Context) {
        if (!ctx.isInGuild) {
            return ctx.reply({
                content: 'This command can only be used in a server.',
            });
        }

        const setups = await getAllSetupsForServer(ctx.interaction.guild_id!);
        const payload = buildSetupList(setups, ctx.interaction.guild_id!);

        return ctx.reply({
            ...payload,
            flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral,
        });
    }
}
