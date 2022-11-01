import mongoose from "mongoose";

import { mongoURI, network } from "../config";

export const connectMongoDB = async () => {
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useCreateIndex: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    });

    console.log("MongoDB connection established to", network);
  } catch (e) {
    console.error("could not connect to MongoDB:", e);
  }
};
