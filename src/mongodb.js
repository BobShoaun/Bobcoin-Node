import mongoose from "mongoose";
import { atlasURI } from "./settings.js";

export const mongodb = () => {
	try {
		mongoose.connect(atlasURI, {
			useNewUrlParser: true,
			useCreateIndex: true,
			useUnifiedTopology: true,
		});
	} catch (e) {
		console.error("could not connect to mongodb");
	}

	const connection = mongoose.connection;
	connection.once("open", () => {
		console.log("MongoDB database connection established");
	});
};
