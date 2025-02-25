const express = require("express");
const cors = require("cors");
const { SerialPort } = require("serialport"); // ✅ FIXED
const { ReadlineParser } = require("@serialport/parser-readline"); // ✅ FIXED

const app = express();
app.use(express.json());
app.use(cors());

// Setup serial communication (Change COM port to match your setup)
const port = new SerialPort({ path: "COM3", baudRate: 9600 }); // ✅ FIXED
const parser = port.pipe(new ReadlineParser({ delimiter: "\n" })); // ✅ FIXED

let buggyState = {
    mode: "unknown",
    parameters: {}
};

// Listen for incoming serial data
parser.on("data", (line) => {
    console.log("Received from Buggy:", line.trim());

    if (line.startsWith("MODE:")) {
        buggyState.mode = line.split(":")[1].trim();
    } else if (line.startsWith("PARAMETERS:")) {
        const params = {};
        const paramLines = line.split("\n").slice(1); // Ignore first line
        
        paramLines.forEach(param => {
            const match = param.match(/(.+?)=(\d+(\.\d+)?)/);
            if (match) params[match[1].trim()] = parseFloat(match[2]);
        });

        buggyState.parameters = params;
    }
});

// Request buggy state when the frontend loads
app.get("/state", (req, res) => {
    port.write("STATE\n");  // Ask buggy for mode
    port.write("PARAMETER\n"); // Ask buggy for parameters
    setTimeout(() => res.json(buggyState), 500); // Wait for response
});

// Update parameters
app.post("/update", (req, res) => {
    Object.entries(req.body).forEach(([key, value]) => {
        port.write(`PARAM:${key}=${value}\n`);
    });
    res.json({ message: "Parameters sent to buggy" });
});

// Start buggy movement
app.post("/start", (req, res) => {
    port.write("GO\n");
    res.json({ message: "Buggy started!" });
});

app.listen(3001, () => console.log("Server running on port 3001"));
