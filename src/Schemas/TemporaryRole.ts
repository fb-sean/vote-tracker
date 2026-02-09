import mongoose, {InferSchemaType, Schema, Types} from "mongoose";

const TemporaryRoleSchema = new Schema(
    {
        guild_id: {
            type: String,
            required: true,
        },
        user_id: {
            type: String,
            required: true,
        },
        role_id: {
            type: String,
            required: true,
        },
        expires_at: {
            type: Date,
            required: true,
        },
    },
    {
        versionKey: false,
        timestamps: true,
    }
);

TemporaryRoleSchema.index({expires_at: 1}, {expireAfterSeconds: 0});

export type TemporaryRole = InferSchemaType<typeof TemporaryRoleSchema> & { _id: Types.ObjectId };

const TemporaryRoleModel = mongoose.model('Vote_Tracker_Temporary_Role', TemporaryRoleSchema);

export default TemporaryRoleModel;
