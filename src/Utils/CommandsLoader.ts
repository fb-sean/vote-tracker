import fs from "fs";
import path from "path";
import Logger from "@Utils/Logger";
import {Command} from "@Types/Discord";
import {APIApplicationCommand, Routes} from "discord-api-types/v10";
import {DiscordClient} from "@API/DiscordClient";

export async function loadCommands() {
    const commands: Partial<APIApplicationCommand>[] = [];

    const loadRoutesFromDir = (dir: string) => {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.lstatSync(fullPath);

            if (stat.isDirectory()) {
                loadRoutesFromDir(fullPath);
            } else if (file.endsWith('.ts') || file.endsWith('.js')) {
                const CommandsClass = require(fullPath).default;

                if (CommandsClass) {
                    const command: Command = new CommandsClass();

                    commands.push(command.data);

                    if (command.execute) {
                        DiscordClient.getInstance().addCommand(command);
                    }

                    Logger.info(`Loaded command ${command.constructor.name}`, 'MIDDLEWARES');
                }
            }
        }
    };

    loadRoutesFromDir(path.join(__dirname, "../Commands"));

    await DiscordClient.getInstance().rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {body: commands});
}