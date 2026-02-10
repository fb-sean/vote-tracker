import mongoose, {InferSchemaType, Schema, Types} from "mongoose";

const VoteSchema = new Schema(
    {
        user_id: {
            type: String,
            required: true,
        },
        server_id: {
            type: String,
            required: true,
        },
        entity_type: {
            type: String,
            enum: ['bot', 'server', 'game'],
            required: true,
        },
        entity_id: {
            type: String,
            required: true,
        },
        platform: {
            type: String,
            required: true,
        },
        is_test: {
            type: Boolean,
            default: false,
        }
    },
    {
        versionKey: false,
        timestamps: true,
    }
);

VoteSchema.index({user_id: 1, server_id: 1});
VoteSchema.index({entity_id: 1, platform: 1});
VoteSchema.index({entity_id: 1, server_id: 1});
VoteSchema.index({server_id: 1, createdAt: -1});
VoteSchema.index({user_id: 1, createdAt: -1});

export type Vote = InferSchemaType<typeof VoteSchema> & { _id: Types.ObjectId };

const VoteModel = mongoose.model('Vote_Tracker_Vote', VoteSchema);

export default VoteModel;
