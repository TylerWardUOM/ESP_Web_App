const express = require("express");
const cors = require("cors");
const { ReadlineParser } = require("@serialport/parser-readline");
const { SerialPort } = require("serialport");

const app = express();
app.use(express.json());
app.use(cors());

let selectedPort = null;
let parser = null;
let buggyState = {
    mode: "unknown",
    parameters: {}
};

app.get("/ports", async (req, res) => {
    try {
        const ports = await SerialPort.list();
        res.json(ports.map(port => port.path));
    } catch (err) {
        res.status(500).json({ error: "Failed to list COM ports" });
    }
});

app.post("/set-port", (req, res) => {
    const { portName } = req.body;

    // Close previous connection if exists
    if (selectedPort) {
        selectedPort.close((err) => {
            if (err) console.error("Error closing port:", err.message);
        });
        if (parser) parser.removeAllListeners();
    }

    selectedPort = new SerialPort({ path: portName, baudRate: 9600 }, (err) => {
        if (err) {
            console.error(`Failed to open ${portName}:`, err.message);
            selectedPort = null; // Reset the variable if it fails
            return res.status(500).json({ error: `Failed to open port: ${err.message}` });
        }

        console.log(`Connected to ${portName}`);
        parser = selectedPort.pipe(new ReadlineParser({ delimiter: "\n" }));

        parser.on("data", (line) => {
            console.log("Received from Buggy:", line.trim());

            if (line.startsWith("MODE:")) {
                buggyState.mode = line.split(":")[1].trim();
            } else if (line.startsWith("PARAMETERS:")) {
                const params = {};
                line.split("\n").slice(1).forEach(param => {
                    const match = param.match(/(.+?)=(\d+(\.\d+)?)/);
                    if (match) params[match[1].trim()] = parseFloat(match[2]);
                });
                buggyState.parameters = params;
            }
        });

        res.json({ message: `Port set to ${portName}` });
    });

    selectedPort.on("error", (err) => {
        console.error(`SerialPort error on ${portName}:`, err.message);
        selectedPort = null; // Reset the variable if the port is disconnected
    });

    selectedPort.on("close", () => {
        console.warn(`SerialPort ${portName} was closed.`);
        selectedPort = null;
    });
});


app.get("/state", (req, res) => {
    if (!selectedPort || !selectedPort.isOpen) {
        return res.status(400).json({ error: "No port selected or port is closed" });
    }

    try {
        selectedPort.write("STATE\n");
        selectedPort.write("PARAMETER\n");

        // Wait for 500ms before sending response to ensure we get data
        setTimeout(() => {
            if (buggyState.mode === "unknown") {
                return res.status(500).json({ error: "Failed to fetch state from buggy" });
            }
            res.json(buggyState);
        }, 500);
    } catch (err) {
        res.status(500).json({ error: "Error communicating with buggy" });
    }
});

app.post("/update", (req, res) => {
    if (!selectedPort || !selectedPort.isOpen) {
        return res.status(400).json({ error: "No port selected or port is closed" });
    }

    try {
        Object.entries(req.body).forEach(([key, value]) => {
            selectedPort.write(`PARAM:${key}=${value}\n`);  
        });

        res.json({ message: "Parameters sent to buggy" });
    } catch (err) {
        res.status(500).json({ error: "Error updating parameters" });
    }
});


// Start buggy movement
app.post("/start", (req, res) => {
    port.write("GO\n");
    res.json({ message: "Buggy started!" });
});


app.listen(3001, () => console.log("Server running on port 3001"));
