import { connectMongoDB } from "../helpers/database.helper";
import { Blocks, BlocksInfo } from "../models";

const minHeight = 3584;

(async () => {
  await connectMongoDB();

  // const result = await Blocks.deleteMany({ height: { $gte: minHeight } });
  // console.log(result);

  process.exit();
})();
