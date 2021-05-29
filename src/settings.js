import dotenv from "dotenv";

dotenv.config();

export const port = process.env.port || 3001;
export const atlasURI = process.env.ATLAS_URI;
