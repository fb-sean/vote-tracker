export interface ITopggOAuthState {
    setup_id: string;
    user_id: string;
    entity_id: string;
    entity_type: 'bot' | 'server' | 'game';
    code_verifier: string;
}

export interface ITopggOAuthProject {
    id: string;
    platform_id: string;
    name: string;
    platform: 'discord' | 'roblox';
    type: 'bot' | 'server' | 'game';
}

export interface ITopggOAuthTokenResponse {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    refresh_token: string;
    scope: string;
    project: ITopggOAuthProject;
}

export interface ITopggOAuthUser {
    id: string;
    username: string;
    avatar: string | null;
    connections: ITopggOAuthUserConnection[];
}

export interface ITopggOAuthUserConnection {
    platform: 'discord' | 'roblox';
    id: string;
}

export interface ITopggIntegration {
    id: string;
    name: string;
    description: string;
    icon_url: string;
    connected: boolean;
}

export interface ITopggApiError {
    error?: string;
    error_description?: string;
    title?: string;
    detail?: string;
}

export interface ITopggIntegrationCreateData {
    connection_id: string;
    webhook_secret: string;
    project: ITopggIntegrationProject;
    user: ITopggIntegrationUser;
}

export interface ITopggIntegrationProject {
    id: string;
    platform: string;
    platform_id: string;
    type: 'bot' | 'server' | 'game';
    name?: string;
    avatar_url?: string;
}

export interface ITopggIntegrationUser {
    id?: string;
    platform_id: string;
    name?: string;
    avatar_url?: string;
}

export interface ITopggIntegrationDeleteData {
    connection_id: string;
}
