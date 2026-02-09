import mongoose, {InferSchemaType, Schema, Types} from "mongoose";

const UserDataSchema = new Schema(
    {
        userId: {
            type: String,
            unique: true,
        },
        username: {
            type: String, // 'bot' or 'server'
        },
        avatar: {
            type: String,
        }
    }
);

export type UserData = InferSchemaType<typeof UserDataSchema> & { _id: Types.ObjectId };

const UserDataModel = mongoose.model('user_data_polls_in_discord', UserDataSchema);

export default UserDataModel;
