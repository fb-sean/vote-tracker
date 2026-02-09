import mongoose, {InferSchemaType, Schema, Types} from "mongoose";

const TopggConnectionSchema = new Schema(
    {
        connection_id: {
            type: String,
        },
        webhook_secret: {
            type: String,
        },
        project_id: {
            type: String,
        },
        project_platform: {
            type: String,
        },
        project_platform_id: {
            type: String,
        },
        project_type: {
            type: String,
        },
        user_id: { // The user that inited the connection at the first place.
            type: String,
        },
        internal_webhook_token: {
            type: String,
        }
    },
    {
        versionKey: false
    }
);

TopggConnectionSchema.index({webhook_secret: 1});
TopggConnectionSchema.index({project_id: 1, project_platform: 1, project_type: 1}, {unique: true});
TopggConnectionSchema.index({connection_id: 1});
TopggConnectionSchema.index({internal_webhook_token: 1}, {unique: true});

export type TopggConnection = InferSchemaType<typeof TopggConnectionSchema> & { _id: Types.ObjectId };

const TopggConnectionModel = mongoose.model('Vote_Tracker_Topgg_Connection', TopggConnectionSchema);

export default TopggConnectionModel;
