import mongoose from "mongoose";

import { mongoURI } from "../config";

export const connectMongoDB = async () => {
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useCreateIndex: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    });

    console.log("MongoDB connection established");
  } catch (e) {
    console.error("could not connect to MongoDB:", e);
  }
};
