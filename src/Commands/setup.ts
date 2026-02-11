import {Context} from "@Utils/Context";
import {Command} from "@Types/Discord";
import {ApplicationIntegrationType, InteractionContextType, MessageFlags,} from "discord-api-types/v10";
import {createSetupState, getUnsetupConnections} from "@Utils/SetupManager";
import {buildEntitySelectionStep, buildUnsetupConnectionsStep} from "@Utils/SetupComponents";
import {errorComponent, loadingComponent} from "@Utils/Components";

export default class SetupCommand implements Command {
    data = {
        name: 'setup',
        description: 'Setup vote tracking for your server or bot',
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
    };

    async execute(ctx: Context, additional) {
        if (additional && additional.directUpdate) {
            await ctx.update(loadingComponent('Votes - Setup Wizard', 'Baking some data together, give me a second!'));
        } else {
            await ctx.reply(loadingComponent('Votes - Setup Wizard', 'Baking some data together, give me a second!'));
        }

        if (!ctx.isInGuild) {
            return ctx.editReply(errorComponent('Votes - Setup Wizard', 'This command can only be used in a server.'));
        }

        const setupId = await createSetupState(ctx.interaction.guild_id!, ctx.user.id);

        const unsetupConnections = await getUnsetupConnections(ctx.user.id);

        if (unsetupConnections.length > 0) {
            return ctx.editReply({
                ...buildUnsetupConnectionsStep(setupId, unsetupConnections),
                flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral,
            });
        }

        return ctx.editReply({
            ...buildEntitySelectionStep(setupId),
            flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral,
        });
    }
}
