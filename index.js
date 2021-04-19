import Express from 'express';

const app = Express();
const port = process.env.port || 3001;
let blocks = [];

app.use(Express.json());
app.use(Express.urlencoded({extended: true}));

app.get("/", (req, res) => {
  res.send("<h1>hello serveeeer</h1>");
}); 

app.get("/block/:id", (req, res) => {
  res.send(`this is a block with id ${req.params.id}`);
});

app.post("/block", (req, res) => {
  blocks.push(req.body);
  res.send(req.body);
});

app.get("/blocks", (req, res) => {
  res.send(blocks);
})

app.listen(port, () => {
  console.log("Server started on port: ", port);
})
