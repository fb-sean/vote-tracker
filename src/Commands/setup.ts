import {Context} from "@Utils/Context";
import {Command} from "@Types/Discord";
import {
    ApplicationIntegrationType,
    ButtonStyle,
    ComponentType,
    InteractionContextType,
    MessageFlags,
    RESTPostAPIChannelMessageJSONBody,
    APIMessageComponentGuildInteraction,
    APIModalSubmitInteraction,
} from "discord-api-types/v10";
import {createSetupState, getCurrentStep, getSetupState, TSetupState} from "@Utils/SetupManager";
import {buildEntitySelectionStep, buildEntityIdStep, buildChannelAndWebhookStep, buildMessagesStep, buildRewardsStep, buildCompleteStep} from "@Utils/SetupComponents";

export default class SetupCommand implements Command {
    data = {
        name: 'setup',
        description: 'Setup vote tracking for your server or bot',
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
    };

    async execute(ctx: Context) {
        if (!ctx.isInGuild) {
            return ctx.reply({
                content: 'This command can only be used in a server.',
            });
        }

        const setupId = await createSetupState(ctx.interaction.guild_id!, ctx.user.id);

        return ctx.reply({
            ...buildEntitySelectionStep(setupId),
            flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral,
        });
    }
}
