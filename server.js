const http = require("http");
const spawn = require("child_process").spawn;
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const app = express();

app.use(express.urlencoded({limit: "1mb", extended: true}));
app.engine("html", require("ejs").renderFile);
app.use("/threejs", express.static(__dirname + "/threejs"));
app.use(cors({origin: "*", optionsSuccessStatus: 200}));

var globalID = 1;

const port = 3000;
const host = "0.0.0.0";
app.listen(port, host, () =>
{
	console.log("App listening on port " + port);
});

app.post("/threejs", (req, res) =>
{
	const id = globalID++;
	if (globalID > 99)
		globalID = 1;
	console.log((id < 10 ? "0" : "") + id + ": received request");
	fs.writeFileSync(__dirname + "/arshadowgan/data/noshadow/01.jpg", Buffer.from(req.body.img.replace(/^data:image\/\w+;base64,/, ""), "base64"));
	fs.writeFileSync(__dirname + "/arshadowgan/data/mask/01.jpg", Buffer.from(req.body.mask.replace(/^data:image\/\w+;base64,/, ""), "base64"));
	var py = spawn("python", ["-u", __dirname + "/arshadowgan/test2.py"]);
	console.log((id < 10 ? "0" : "") + id + ": started python");
	py.stdout.on("data", (pyData) =>
	{
		console.log((id < 10 ? "0" : "") + id + ": got python output");
		pyData = pyData.toString();
		var contour = pyData.split(" ");
		if (isNaN(contour[0]))
			res.send("0 1 0");
		else
		{
			var result = "";
			var child = spawn("node", [__dirname + "/child.js", pyData, req.body.scene]);
			console.log("node child.js " + pyData + " " + req.body.scene);
			child.stdout.on("data", (data) =>
			{
				result = data.toString();
				result = result.replace(/(\r\n|\n|\r)/gm, "");
				console.log((id < 10 ? "0" : "") + id + ": returned (" + result + ")");
				res.send(result);
				child.kill();
			});
		}
		py.kill();
	});
});
