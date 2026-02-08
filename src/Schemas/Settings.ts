import mongoose, {InferSchemaType, Schema, Types} from "mongoose";

const RewardSchema = new Schema(
    {
        role_id: {
            type: String,
        },
        duration_min: {
            type: Number,
            default: 0
        },
        min_votes: {
            type: Number,
            default: 0
        },
    },
    {
        versionKey: false
    }
);

const MessageSchema = new Schema(
    {
        type: {
            type: String,
            enum: ['first-vote', 'vote']
        },
        payload: {
            type: String,
            default: '' // JSON Payload
        },
    }
)

const SettingsSchema = new Schema(
    {
        server_id: {
            type: String,
        },
        entity_id: {
            type: String,
        },
        entity_type: {
            type: String, // 'bot' or 'server'
        },
        channel_id: {
            type: String,
            default: null
        },
        auth_token: {
            type: String,
            default: null
        },
        external_webhook_url: {
            type: String,
            default: null
        },
        rewards: {
            type: [RewardSchema],
            default: []
        },
        messages: {
            type: [MessageSchema],
            default: []
        },
    },
    {
        versionKey: false
    }
);

SettingsSchema.index({
    auth_token: 1
});

export type Settings = InferSchemaType<typeof SettingsSchema> & { _id: Types.ObjectId };

const SettingsModel = mongoose.model('Vote_Tracker_Settings', SettingsSchema);

export default SettingsModel;
