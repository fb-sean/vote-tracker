import mongoose, {InferSchemaType, Schema, Types} from "mongoose";

const EntityStreakSchema = new Schema(
    {
        user_id: {
            type: String,
            required: true,
        },
        entity_id: {
            type: String,
            required: true,
        },
        entity_type: {
            type: String,
            enum: ['bot', 'server', 'game'],
            required: true,
        },
        current_streak: {
            type: Number,
            default: 1,
        },
        best_streak: {
            type: Number,
            default: 1,
        },
        last_vote_at: {
            type: Date,
            default: Date.now,
        },
        previous_vote_at: {
            type: Date,
            default: null,
        },
        vote_count: {
            type: Number,
            default: 1,
        },
    },
    {
        versionKey: false,
    }
);

EntityStreakSchema.index(
    { user_id: 1, entity_id: 1, entity_type: 1 },
    { unique: true }
);

EntityStreakSchema.index({ entity_id: 1, entity_type: 1 });

EntityStreakSchema.index({ current_streak: -1 });
EntityStreakSchema.index({ best_streak: -1 });

export type EntityStreak = InferSchemaType<typeof EntityStreakSchema> & { _id: Types.ObjectId };

const EntityStreakModel = mongoose.model('Vote_Tracker_Entity_Streak', EntityStreakSchema);

export default EntityStreakModel;
