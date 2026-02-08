// src/Loaders/loadCronJobs.ts
import fs from "fs";
import path from "path";
import {CronJob} from "cron";
import Logger from "@Utils/Logger";
import type {TCronJob} from "@Types/CronJobs";

export async function loadCronJobs() {
    const cronJobs = new Map<string, CronJob>();
    const jobInstancesByTime = new Map<string, TCronJob[]>();
    let jobs = 0;

    const loadFromDir = (dir: string) => {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.lstatSync(fullPath);

            if (stat.isDirectory()) {
                loadFromDir(fullPath);
            } else if (file.endsWith(".ts") || file.endsWith(".js")) {
                const mod = require(fullPath);
                const JobClass = mod?.default ?? mod;

                if (!JobClass) continue;

                const jobInstance: TCronJob = new JobClass();

                if (!jobInstancesByTime.has(jobInstance.time)) {
                    jobInstancesByTime.set(jobInstance.time, []);
                }

                jobInstancesByTime.get(jobInstance.time)!.push(jobInstance);

                jobs++;
            }
        }
    };

    loadFromDir(path.join(__dirname, "../CronJobs"));

    for (const [time, instances] of jobInstancesByTime.entries()) {
        const tz = instances[0]?.timezone || "Europe/Berlin";

        const cronJob = new CronJob(
            time,
            async () => {
                await Promise.all(
                    instances.map(async (job) => {
                        return job.execute();
                    })
                );
            },
            null,
            true,
            tz
        );

        cronJobs.set(time, cronJob);

        Logger.info(`Cron registered for ${time} (${instances.length} job${instances.length > 1 ? "s" : ""})`, 'CRON');
    }

    Logger.info(`Loaded ${jobs} cron job instance(s)`, 'CRON');
}