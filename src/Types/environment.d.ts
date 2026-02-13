declare global {
    namespace NodeJS {
        interface ProcessEnv {
            STARTED_AT: number;

            PORT: number;

            QUEUE_NAME: string;

            REDIS_HOST: string;
            REDIS_PORT: number;
            REDIS_PASSWORD: string;

            DATABASE_URL: string;

            DISCORD_CLIENT_ID: string;
            DISCORD_CLIENT_SECRET: string;
            DISCORD_CLIENT_PUBLIC_KEY: string;
            DISCORD_CLIENT_TOKEN: string;
            DISCORD_AUTH_CALLBACK_URL: string;

            PROXY_WORKER_TOKEN: string;

            TOP_GG_TOKEN: string;
        }
    }
}

export {}