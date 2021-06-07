import dotenv from "dotenv";

dotenv.config();

export const port = process.env.PORT || 3001;
export const atlasURI = `mongodb+srv://${process.env.MONGO_ATLAS_USERNAME}:${process.env.MONGO_ATLAS_PASSWORD}@cluster0.owydh.mongodb.net/Bobcoin-Node?retryWrites=true&w=majority`;
