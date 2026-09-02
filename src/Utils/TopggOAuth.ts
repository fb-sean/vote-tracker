import axios from "axios";
import {createHash, createHmac, randomBytes, timingSafeEqual} from "crypto";
import Redis from "@API/RedisCache";
import type {TSetupState} from "@Utils/SetupManager";
import type {
    ITopggIntegration,
    ITopggOAuthProject,
    ITopggOAuthState,
    ITopggOAuthTokenResponse,
    ITopggOAuthUser,
} from "@Types/TopggOAuth";

const TOPGG_API_URL = 'https://top.gg/api/v1';
const TOPGG_AUTHORIZATION_URL = 'https://top.gg/oauth2/authorize';
const TOPGG_OAUTH_STATE_EXPIRATION_SECONDS = 60 * 30;
const TOPGG_OAUTH_SCOPES = 'user.identify project.integrations.write';
const TOPGG_INTEGRATION_NAME = 'Votes';
const TOPGG_INTEGRATION_CALLBACK_SECRET_CONTEXT = 'vote-tracker/topgg-integration-callback/v1';

export class TopggOAuthError extends Error {
}

export function buildTopggAuthorizationStartUrl(setupId: string): string {
    const authorizationStartUrl = new URL('/integrations/top-gg/authorize', process.env.TOP_GG_AUTH_CALLBACK_URL);
    authorizationStartUrl.searchParams.set('setup_id', setupId);

    return authorizationStartUrl.toString();
}

export function buildTopggIntegrationRegistrationUrl(): string {
    const registrationUrl = new URL('/integrations/top-gg/register', process.env.TOP_GG_AUTH_CALLBACK_URL);
    registrationUrl.searchParams.set('secret', getTopggIntegrationCallbackSecret());

    return registrationUrl.toString();
}

export function verifyTopggIntegrationCallbackSecret(providedSecret: string | null): boolean {
    if (!providedSecret) {
        return false;
    }

    const expectedSecretBuffer = Buffer.from(getTopggIntegrationCallbackSecret());
    const providedSecretBuffer = Buffer.from(providedSecret);

    return expectedSecretBuffer.length === providedSecretBuffer.length
        && timingSafeEqual(expectedSecretBuffer, providedSecretBuffer);
}

export async function createTopggAuthorizationUrl(setupId: string, setupState: TSetupState): Promise<string> {
    if (!setupState.entity_id || !setupState.entity_type) {
        throw new TopggOAuthError('The setup does not have a valid project. Return to Discord and start over.');
    }

    const oauthStateId = randomBytes(32).toString('hex');
    const codeVerifier = randomBytes(64).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const oauthState: ITopggOAuthState = {
        setup_id: setupId,
        user_id: setupState.user_id,
        entity_id: setupState.entity_id,
        entity_type: setupState.entity_type,
        code_verifier: codeVerifier,
    };

    await Redis.getInstance().set(getTopggOAuthStateKey(oauthStateId), oauthState, TOPGG_OAUTH_STATE_EXPIRATION_SECONDS);

    const authorizationUrl = new URL(TOPGG_AUTHORIZATION_URL);
    authorizationUrl.searchParams.set('client_id', process.env.TOP_GG_CLIENT_ID);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('redirect_uri', process.env.TOP_GG_AUTH_CALLBACK_URL);
    authorizationUrl.searchParams.set('scope', TOPGG_OAUTH_SCOPES);
    authorizationUrl.searchParams.set('state', oauthStateId);
    authorizationUrl.searchParams.set('code_challenge', codeChallenge);
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');
    authorizationUrl.searchParams.set('project', 'discord');
    authorizationUrl.searchParams.set('project_id', setupState.entity_id);

    return authorizationUrl.toString();
}

export async function consumeTopggOAuthState(oauthStateId: string): Promise<ITopggOAuthState | null> {
    return Redis.getInstance().getAndDelete<ITopggOAuthState>(getTopggOAuthStateKey(oauthStateId));
}

export async function connectTopggIntegration(authorizationCode: string, oauthState: ITopggOAuthState): Promise<ITopggOAuthProject> {
    const tokenRequest = new URLSearchParams({
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: process.env.TOP_GG_AUTH_CALLBACK_URL,
        code_verifier: oauthState.code_verifier,
        client_id: process.env.TOP_GG_CLIENT_ID,
        client_secret: process.env.TOP_GG_CLIENT_SECRET,
    });
    const tokenResponse = await axios.post<ITopggOAuthTokenResponse>(`${TOPGG_API_URL}/oauth2/token`, tokenRequest.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });
    const project = tokenResponse.data.project;

    const expectedPlatform = oauthState.entity_type === 'game' ? 'roblox' : 'discord';
    const hasMatchingProjectId = oauthState.entity_type === 'game'
        ? project?.id === oauthState.entity_id
        : project?.platform_id === oauthState.entity_id;
    if (
        !project
        || !hasMatchingProjectId
        || project.type !== oauthState.entity_type
        || project.platform !== expectedPlatform
    ) {
        throw new TopggOAuthError('The selected Top.gg project does not match the project being configured in Discord.');
    }

    const authorizationHeaders = {
        Authorization: `Bearer ${tokenResponse.data.access_token}`,
    };
    const userResponse = await axios.get<ITopggOAuthUser>(`${TOPGG_API_URL}/users/@me`, {
        headers: authorizationHeaders,
    });
    const hasMatchingDiscordAccount = userResponse.data.connections.some(connection => (
        connection.platform === 'discord' && connection.id === oauthState.user_id
    ));

    if (!hasMatchingDiscordAccount) {
        throw new TopggOAuthError('The Discord account linked to Top.gg does not match the account that started this setup.');
    }

    const integrationsResponse = await axios.get<ITopggIntegration[]>(`${TOPGG_API_URL}/projects/${encodeURIComponent(project.id)}/integrations`, {
        headers: authorizationHeaders,
    });
    const votesIntegration = integrationsResponse.data.find(integration => integration.name.toLowerCase() === TOPGG_INTEGRATION_NAME.toLowerCase());

    if (!votesIntegration) {
        throw new TopggOAuthError('The Votes integration is not available for the selected Top.gg project.');
    }

    if (!votesIntegration.connected) {
        await axios.put(
            `${TOPGG_API_URL}/projects/${encodeURIComponent(project.id)}/integrations/${encodeURIComponent(votesIntegration.id)}`,
            undefined,
            {headers: authorizationHeaders},
        );
    }

    return project;
}

function getTopggOAuthStateKey(oauthStateId: string): string {
    return `discord:vt:topgg:oauth:${oauthStateId}`;
}

function getTopggIntegrationCallbackSecret(): string {
    return createHmac('sha256', process.env.TOP_GG_CLIENT_SECRET)
        .update(TOPGG_INTEGRATION_CALLBACK_SECRET_CONTEXT)
        .digest('base64url');
}
