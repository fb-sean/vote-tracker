export type TCronJob = {
    time: string;                // cron string
    timezone?: string;           // e.g. "Europe/Berlin"
    execute: () => Promise<void>;
}