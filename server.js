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

let isReadingParams = false;
let tempParams = {};  // Temporary storage for parameters
let isConnected = false;  // Track if the system is connected
let currentPort = null;   // Track which port the system is connected to

app.get("/ports", async (req, res) => {
    try {
        const ports = await SerialPort.list();
        res.json(ports.map(port => port.path));
    } catch (err) {
        res.status(500).json({ error: "Failed to list COM ports" });
    }
});

// Set the port for communication
app.post("/set-port", (req, res) => {
    const { portName } = req.body;

    // Close previous connection if exists
    if (selectedPort) {
        selectedPort.close((err) => {
            if (err) console.error("Error closing port:", err.message);
        });
        if (parser) parser.removeAllListeners();
    }

    // Establish connection to the new port
    selectedPort = new SerialPort({ path: portName, baudRate: 9600 }, (err) => {
        if (err) {
            console.error(`Failed to open ${portName}:`, err.message);
            selectedPort = null; // Reset the variable if it fails
            return res.status(500).json({ error: `Failed to open port: ${err.message}` });
        }
        isConnected = true;
        currentPort = portName;
        console.log(`Connected to ${portName}`);
        parser = selectedPort.pipe(new ReadlineParser({ delimiter: "\n" }));

        parser.on("data", (line) => {
            line = line.trim();
            console.log("Received from Buggy:", line);

            if (line.startsWith("MODE:")) {
                buggyState.mode = line.split(":")[1].trim();
                isReadingParams = false; // Stop reading parameters
            } else if (line.startsWith("PARAMETERS:")) {
                isReadingParams = true;  // Start capturing parameters
                tempParams = {};  // Reset temporary storage
            } else if (line.startsWith("PARAMETERS_DONE")) {
                isReadingParams = false; // Stop reading parameters when "PARAMETERS_DONE" is received
                buggyState.parameters = { ...tempParams };  // Save collected parameters
                console.log("Parameters received and saved");
            } else if (isReadingParams) {
                // Split the line by commas to handle multiple key-value pairs
                const pairs = line.split(",");
                pairs.forEach(pair => {
                    // Match key-value pairs (e.g., Key=Value)
                    const match = pair.trim().match(/(\S+)\s*=\s*(\d+(\.\d+)?)/);
                    if (match) {
                        tempParams[match[1].trim()] = parseFloat(match[2]);
                    }
                });
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


// Endpoint to get the connection state
app.get("/connection-state", (req, res) => {
    res.json({
        isConnected,
        currentPort
    });
});


// Get the current state of the buggy
app.get("/state", (req, res) => {
    if (!selectedPort || !selectedPort.isOpen) {
        return res.status(400).json({ error: "No port selected or port is closed" });
    }

    try {
        selectedPort.write("STATE\n");
        selectedPort.write("PARAMETER\n");

        // Wait for 500ms before sending response to ensure we get data
        setTimeout(() => {
            console.log("Final Buggy State:", buggyState); // Debugging
            if (buggyState.mode === "unknown") {
                return res.status(500).json({ error: "Failed to fetch state from buggy" });
            }
            res.json(buggyState);
        }, 500);
    } catch (err) {
        res.status(500).json({ error: "Error communicating with buggy" });
    }
});

// Update parameters on the buggy
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



let isMovementFinished = false;
let awaitingDebugData = false; // Track if we are in debug data collection mode
let accumulatedDebugData = []; // Store the debug data

// Start the buggy movement and collect debug data
app.post("/start", (req, res) => {
    console.log("📢 Received request to start movement");

    if (!selectedPort || !selectedPort.isOpen) {
        console.error("⛔ No port selected or port is closed");
        return res.status(400).json({ error: "No port selected or port is closed" });
    }

    try {
        console.log("🚀 Sending GO command to start movement");
        selectedPort.write("GO\n"); // Send the command to start movement

        // Reset movement state and debug data
        isMovementFinished = false;
        awaitingDebugData = false;
        accumulatedDebugData = [];

        // Send an immediate response to the frontend
        res.json({ message: "STARTING MOVEMENT" });

        // Only add the debug data listener if not already listening
        if (!awaitingDebugData) {
            awaitingDebugData = true; // Start debug data collection mode
            parser.on("data", handleDebugData);
        }

    } catch (err) {
        console.error("❌ Error starting buggy:", err);
        res.status(500).json({ error: "Error starting buggy" });
    }
});

// Function to handle the debug data
function handleDebugData(line) {
    line = line.trim();
    console.log("📩 Received data:", line); // Debug print for raw incoming data

    if (line === "MOVEMENT FINISHED") {
        console.log("✅ Movement finished!");
        isMovementFinished = true;
    } else if (line === "DEBUG DATA:") {
        console.log("📡 Debug data started, awaiting more lines...");
        accumulatedDebugData = []; // Reset previous debug data
    } else if (line === "DEBUG_END") {
        console.log("🚀 DEBUG_END received, sending accumulated debug data:", accumulatedDebugData);
        awaitingDebugData = false; // Stop collecting debug data
        sendDebugDataToFrontend(); // Send collected debug data to the frontend

        // Remove the debug data listener now that it's done
        parser.removeListener("data", handleDebugData);
    } else if (awaitingDebugData) {
        const debugLine = parseDebugLine(line);
        if (debugLine) {
            console.log("➕ Adding debug data:", debugLine);
            accumulatedDebugData.push(debugLine);
        }
    }
}

// Helper function to parse each debug data line into a structured format
function parseDebugLine(line) {
    const debugObj = {};
    const [timePart, keyValuesPart] = line.split(":");

    if (timePart) {
        debugObj.time = timePart.trim();
    }

    if (keyValuesPart) {
        const pairs = keyValuesPart.split(",").map(pair => pair.trim());
        pairs.forEach(pair => {
            const [key, value] = pair.split("=");
            if (key && value) {
                debugObj[key.trim()] = value.trim();
            }
        });
    }

    return debugObj;
}




// API endpoint to serve accumulated debug data
app.get("/debug-data", (req, res) => {
    console.log("📤 Sending debug data to frontend:", accumulatedDebugData);
    res.json(accumulatedDebugData);

    // Optional: Clear data after sending
    accumulatedDebugData = [];
    console.log("🔄 Debug data reset after sending.");
});

// Function to handle when debug data is ready
function sendDebugDataToFrontend() {
    console.log("📤 Debug data ready, available at /debug-data:", accumulatedDebugData);
}




// Endpoint to check if movement is finished
app.get("/is-movement-finished", (req, res) => {
    res.json({ finished: isMovementFinished });
});



// Disconnect the port
app.post("/disconnect", (req, res) => {
    if (selectedPort) {
        selectedPort.close((err) => {
            if (err) {
                console.error("Error closing port:", err.message);
                return res.status(500).json({ error: `Failed to disconnect: ${err.message}` });
            }
            isConnected = false;
            currentPort = null;
            console.log("Port disconnected successfully.");
            selectedPort = null;
            parser = null;
            res.json({ message: "Port disconnected successfully" });
        });
    } else {
        res.status(400).json({ error: "No port is currently connected" });
    }
});// Set the mode on the buggy
app.post("/setMode", (req, res) => {
    const { mode } = req.body;

    if (!selectedPort || !selectedPort.isOpen) {
        return res.status(400).json({ error: "No port selected or port is closed" });
    }

    try {
        const command = `SET_MODE:${mode}\n`;
        selectedPort.write(command, (err) => {
            if (err) {
                console.error(`Error sending mode command: ${err.message}`);
                return res.status(500).json({ error: `Error sending mode command: ${err.message}` });
            }

            console.log(`Sent mode change command: ${command}`);
            res.json({ message: `Mode changed to ${mode}` });
        });
    } catch (err) {
        res.status(500).json({ error: `Error setting mode: ${err.message}` });
    }
});



// Start the server
app.listen(3001, () => console.log("Server running on port 3001"));
