import {TWorker, IWorkerPayloadData, EWorkerJobs} from "@Types/RedisQueue";
import SettingsModel from "@Schemas/Settings";
import Logger from "@Utils/Logger";
import type {ISendExternalWebhookPayload} from "@Types/Workers";
import {ProxyAgent} from "undici";
import Redis from "@API/RedisCache";

export default class SendExternalWebhookWorker implements TWorker {
    jobName = EWorkerJobs.SendExternalWebhook;
    maxPerSecond = 30;
    maxDuration = 1000;

    private proxyAgent: ProxyAgent | null = null;

    async execute(payload: IWorkerPayloadData): Promise<void> {
        const data = payload as unknown as ISendExternalWebhookPayload;
        const startTime = Date.now();

        try {
            const settings = data.settings;
            if (!settings) {
                Logger.warn(`Settings not found for ${data.entity_id}`, 'EXTERNAL_WEBHOOK');

                return;
            }

            if (settings.disabled) {
                Logger.info(`Settings ${settings.server_id} is disabled, skipping webhook`, 'EXTERNAL_WEBHOOK');

                return;
            }

            if (!settings.external_webhook_url) {
                Logger.info(`No external webhook configured for ${settings.server_id}`, 'EXTERNAL_WEBHOOK');

                return;
            }

            const webhookPayload = this.buildWebhookPayload(data);

            await this.sendWebhook(settings.external_webhook_url, webhookPayload);

            const duration = Date.now() - startTime;
            Logger.info(`SendExternalWebhook completed in ${duration}ms`, 'EXTERNAL_WEBHOOK');
        } catch (error) {
            Logger.error(`Error in SendExternalWebhook: ${error}`, 'EXTERNAL_WEBHOOK');
            console.log(error);
        }
    }

    private buildWebhookPayload(payload: ISendExternalWebhookPayload): Record<string, unknown> {
        const basePayload: Record<string, unknown> = {
            entity_type: payload.entity_type,
            entity_id: payload.entity_id,
            voter_id: payload.user_id,
            platform: payload.platform,
            guild_id: payload.guild_id,
            is_test: payload.is_test,
            is_first_vote: payload.is_first_vote,
        };

        basePayload.count = {
            all: payload.vote_counts.all,
            month: payload.vote_counts.month,
            year: payload.vote_counts.year,
            week: payload.vote_counts.week,
        };

        basePayload.streak = {
            current: payload.streak.current,
            best: payload.streak.best,
            last: payload.streak.last,
        };

        return basePayload;
    }

    private async sendWebhook(url: string, payload: Record<string, unknown>): Promise<void> {
        try {
            const errorCount = await Redis.getInstance().get<number>('vt:externalwebhookerrors:' + url);
            if (errorCount && errorCount >= 15) {
                Logger.warn(`External webhook ${url} has been hit too many times, skipping`, 'EXTERNAL_WEBHOOK');

                return;
            }

            // const dispatcher = this.getProxyAgent();
            const fetchOptions: RequestInit = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'VoteTracker/1.0',
                },
                body: JSON.stringify(payload),
            };

            // if (dispatcher) {
            //     (fetchOptions as {dispatcher: unknown}).dispatcher = dispatcher;
            // }

            const response = await fetch(url, fetchOptions);

            if (response.status >= 400) {
                await Redis.getInstance().set('vt:externalwebhookerrors:' + url, (errorCount ? errorCount + 1 : 1), 60 * 60);

                Logger.warn(
                    `External webhook ${url} returned status ${response.status}`,
                    'EXTERNAL_WEBHOOK'
                );
            }
        } catch (error: unknown) {
            const err = error as {message?: string};

            Logger.error(
                `Failed to send external webhook: ${err.message || 'Unknown error'}`,
                'EXTERNAL_WEBHOOK'
            );
        }
    }

    private getProxyAgent(): ProxyAgent | null {
        if (this.proxyAgent) {
            return this.proxyAgent;
        }

        const proxyHost = process.env.PROXY_HOST;
        const proxyPort = process.env.PROXY_PORT;
        const proxyUsername = process.env.PROXY_USERNAME;
        const proxyPassword = process.env.PROXY_PASSWORD;

        if (!proxyHost || !proxyPort) {
            return null;
        }

        try {
            let proxyUrl = `http://`;

            if (proxyUsername && proxyPassword) {
                proxyUrl += `${encodeURIComponent(proxyUsername)}:${encodeURIComponent(proxyPassword)}@`;
            }

            proxyUrl += `${proxyHost}:${proxyPort}`;

            this.proxyAgent = new ProxyAgent(proxyUrl);

            Logger.info(`Using proxy: ${proxyHost}:${proxyPort}`, 'EXTERNAL_WEBHOOK');

            return this.proxyAgent;
        } catch (error) {
            Logger.error(`Failed to create proxy agent: ${error}`, 'EXTERNAL_WEBHOOK');
            return null;
        }
    }
}
