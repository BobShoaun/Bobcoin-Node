import mongoose from "mongoose";
import { atlasURI } from "./config.js";

export const mongodb = () => {
	try {
		mongoose.connect(atlasURI, {
			useNewUrlParser: true,
			useCreateIndex: true,
			useUnifiedTopology: true,
			useFindAndModify: false,
		});
	} catch (e) {
		console.error("could not connect to mongodb");
	}

	const connection = mongoose.connection;
	connection.once("open", () => {
		console.log("MongoDB database connection established");
	});
};
