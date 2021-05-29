import mongoose from "mongoose";
import dotenv from "dotenv";

export const mongodb = () => {
	dotenv.config();
	const uri = process.env.ATLAS_URI;

	try {
		mongoose.connect(uri, {
			useNewUrlParser: true,
			useCreateIndex: true,
			useUnifiedTopology: true,
		});
	} catch (e) {
		console.error("could not connect");
	}

	const connection = mongoose.connection;
	connection.once("open", () => {
		console.log("MongoDB database connection established");
	});
};
