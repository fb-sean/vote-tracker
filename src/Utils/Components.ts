import {ComponentType, MessageFlags} from "discord-api-types/v10";
import {BrightImages} from "@Utils/BrightImages";
import {IContextPayloadExtended} from "@Types/Context";

export function loadingComponent(title: string, text: string = 'Loading...'): IContextPayloadExtended {
    return infoComponent(title, text, BrightImages.Thinking);
}

export function errorComponent(title: string, text: string = 'Error...'): IContextPayloadExtended {
    return {
        components: [
            {
                type: ComponentType.Container,
                accent_color: 15548997,
                components: [
                    {
                        type: ComponentType.Section,
                        accessory: {
                            type: ComponentType.Thumbnail,
                            media: {
                                url: BrightImages.Shrug
                            }
                        },
                        components: [
                            {
                                type: ComponentType.TextDisplay,
                                content: '### ' + title
                            },
                            {
                                type: ComponentType.TextDisplay,
                                content: text
                            }
                        ]
                    }
                ]
            }
        ],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral,
    };
}

export function successComponent(title: string, text: string = 'Success!'): IContextPayloadExtended {
    return {
        components: [
            {
                type: ComponentType.Container,
                accent_color: 5763719,
                components: [
                    {
                        type: ComponentType.Section,
                        accessory: {
                            type: ComponentType.Thumbnail,
                            media: {
                                url: BrightImages.ThumbsUp
                            }
                        },
                        components: [
                            {
                                type: ComponentType.TextDisplay,
                                content: '### ' + title
                            },
                            {
                                type: ComponentType.TextDisplay,
                                content: text
                            }
                        ]
                    }
                ]
            }
        ],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral,
    };
}

export function infoComponent(title: string, text: string = 'Success!', customBright?: BrightImages): IContextPayloadExtended {
    return {
        components: [
            {
                type: ComponentType.Container,
                accent_color: 0x616ee3,
                components: [
                    {
                        type: ComponentType.Section,
                        accessory: {
                            type: ComponentType.Thumbnail,
                            media: {
                                url: customBright ?? BrightImages.Peace
                            }
                        },
                        components: [
                            {
                                type: ComponentType.TextDisplay,
                                content: '### ' + title
                            },
                            {
                                type: ComponentType.TextDisplay,
                                content: text
                            }
                        ]
                    }
                ]
            }
        ],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications | MessageFlags.Ephemeral,
    };
}