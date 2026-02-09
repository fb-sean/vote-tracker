import {TWorker, IWorkerPayloadData, EWorkerJobs} from "@Types/RedisQueue";
import SettingsModel from "@Schemas/Settings";
import Logger from "@Utils/Logger";
import type {ISendExternalWebhookPayload} from "@Types/Workers";
import {ProxyAgent} from "undici";

export default class SendExternalWebhookWorker implements TWorker {
    jobName = EWorkerJobs.SendExternalWebhook;
    maxPerSecond = 30;
    maxDuration = 1000;

    async execute(payload: IWorkerPayloadData): Promise<void> {
        const data = payload as unknown as ISendExternalWebhookPayload;
        const startTime = Date.now();

        try {
            Logger.info(`Sending external webhook for ${data.user_id} from ${data.platform}`, 'EXTERNAL_WEBHOOK');

            const settings = await SettingsModel.findOne({server_id: data.server_id});
            if (!settings) {
                Logger.warn(`Settings not found for ${data.server_id}`, 'EXTERNAL_WEBHOOK');

                return;
            }

            if (settings.disabled) {
                Logger.info(`Settings ${data.server_id} is disabled, skipping webhook`, 'EXTERNAL_WEBHOOK');

                return;
            }

            if (!settings.external_webhook_url) {
                Logger.info(`No external webhook configured for ${data.server_id}`, 'EXTERNAL_WEBHOOK');

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
            voterId: payload.user_id,
            platform: payload.platform,
            isTest: payload.is_test,
        };

        if (payload.server_id) {
            basePayload.guildId = payload.server_id;
        }

        basePayload.count = {
            all: payload.vote_counts.all,
            month: payload.vote_counts.thisMonth,
            year: payload.vote_counts.thisYear,
            week: payload.vote_counts.thisWeek,
        };

        basePayload.streak = {
            current: payload.streak.current,
            best: payload.streak.best,
            lastVote: payload.streak.lastVote,
        };

        if (payload.user_data) {
            basePayload.user = {
                username: payload.user_data.username,
                avatar: payload.user_data.avatar,
            };
        }

        basePayload.isFirstVote = payload.is_first_vote;

        return basePayload;
    }

    private async sendWebhook(url: string, payload: Record<string, unknown>): Promise<void> {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'VoteTracker/1.0',
                },
                body: JSON.stringify(payload),
            });

            if (response.status >= 400) {
                Logger.warn(
                    `External webhook returned status ${response.status}`,
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
}
