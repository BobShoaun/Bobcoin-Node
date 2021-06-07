import dotenv from "dotenv";

dotenv.config();

export const port = process.env.PORT || 3001;
export const atlasURI = process.env.ATLAS_URI;
