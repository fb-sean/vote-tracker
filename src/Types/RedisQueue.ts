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
    SendTestLoggingMessage = 'SEND_TEST_LOGGING_MESSAGE',
    SendExternalWebhookNotification = 'SEND_EXTERNAL_WEBHOOK_NOTIFICATION',
}