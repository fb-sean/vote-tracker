import mongoose, {InferSchemaType, Schema, Types} from "mongoose";

const VoteSchema = new Schema(
    {
        entity_id: {
            type: String,
        },
        entity_type: {
            type: String, // 'bot' or 'server'
        },
        user_id: {
            type: String,
        },
        date: {
            type: Date,
            default: Date.now
        }
    },
    {
        versionKey: false
    }
);

VoteSchema.index({entity_id: 1, entity_type: 1, user_id: 1});
VoteSchema.index({user_id: 1});

export type Vote = InferSchemaType<typeof VoteSchema> & { _id: Types.ObjectId };

const VoteModel = mongoose.model('Vote_Tracker_Vote', VoteSchema);

export default VoteModel;
