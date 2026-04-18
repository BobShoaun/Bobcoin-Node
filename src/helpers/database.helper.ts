import mongoose from "mongoose";

import { mongoURI } from "../config";

export const connectMongoDB = async () => {

  if (!mongoURI)
    throw new Error("MONGODB_URI is not defined in environment variables");

  try {
    await mongoose.connect(mongoURI, {});

    console.log("MongoDB connection established");
  } catch (e) {
    console.error("could not connect to MongoDB:", e);
  }
};
