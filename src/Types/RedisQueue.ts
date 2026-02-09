export interface IWorkerPayloadData {
    [key: string]: string | number | boolean | null | object;
}

export type TWorkerEvent = (data: IWorkerPayloadData) => Promise<void>;

export type TWorker = {
    jobName: EWorkerJobs;
    maxPerSecond?: number;
    maxDuration?: number;
    concurrency?: number;
    execute: TWorkerEvent;
};

export enum EWorkerJobs {
    Unknown = 'UNKNOWN',
    DisconnectedTopggWebhook = 'DISCONNECTED_TOPGG_WEBHOOK'
}