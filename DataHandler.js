class DataHandler {
    constructor(bleCharacteristic = null, serialWriter = null) {
        this.isSendingCommand = false;
        this.awaitingResponse = null;
        this.lastResponse = null;
        this.awaitingDebugData = false;
        this.accumulatedDebugData = [];
        this.isReadingParams = false;
        this.tempParams = {};
        this.buggyState = { mode: "", parameters: {} };
        this.isMovementFinished = false;
        this.bleCharacteristic = bleCharacteristic;
        this.serialWriter = serialWriter;
        this.lastRunMode = null; 
        this.lastRunParameters = {};
    }

    setBLE(bleCharacteristic) {
        this.bleCharacteristic = bleCharacteristic;
    }

    setSerial(serialWriter) {
        this.serialWriter = serialWriter;
    }

    async sendCommandNoWait(command) {
        if (!this.bleCharacteristic && !this.serialWriter) {
            console.warn("[sendCommand] ⚠️ No communication method set!");
            return;
        }
    
        if (this.isSendingCommand) {
            console.warn("[sendCommand] ⏳ Command in progress. Try again later.");
            return;
        }
    
        this.isSendingCommand = true;
    
        try {
            let encodedCommand = new TextEncoder().encode(command + "\n");
            const maxChunkSize = 20;
    
            console.log(`[sendCommand] 📤 Sending: "${command}"`);
    
            if (this.bleCharacteristic) {
                // Sending in chunks over BLE (if applicable)
                for (let i = 0; i < encodedCommand.length; i += maxChunkSize) {
                    let chunk = encodedCommand.slice(i, i + maxChunkSize);
                    console.log(`[sendCommand] 📤 BLE Chunk: ${new TextDecoder().decode(chunk)}`);
                    await this.bleCharacteristic.writeValue(chunk);
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } else if (this.serialWriter) {
                // Sending the command over Serial (if applicable)
                await this.serialWriter.write(encodedCommand);
            }
        } catch (error) {
            console.error("[sendCommand] ❌ Error:", error);
        } finally {
            this.isSendingCommand = false;
        }
    }
    
    async sendCommandAndWait(command, expectedResponse, timeout = 5000) {
        if (!this.bleCharacteristic && !this.serialWriter) {
            console.warn("[sendCommandAndWait] ⚠️ No communication method set!");
            return;
        }
    
        if (this.isSendingCommand) {
            console.warn("[sendCommandAndWait] ⏳ Command in progress. Try again later.");
            return;
        }
    
        this.isSendingCommand = true;
        this.awaitingResponse = expectedResponse;
        this.lastResponse = null;
    
        try {
            let encodedCommand = new TextEncoder().encode(command + "\n");
            const maxChunkSize = 20;
    
            console.log(`[sendCommandAndWait] 📤 Sending: "${command}"`);
    
            if (this.bleCharacteristic) {
                for (let i = 0; i < encodedCommand.length; i += maxChunkSize) {
                    let chunk = encodedCommand.slice(i, i + maxChunkSize);
                    console.log(`[sendCommandAndWait] 📤 BLE Chunk: ${new TextDecoder().decode(chunk)}`);
                    await this.bleCharacteristic.writeValue(chunk);
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } else if (this.serialWriter) {
                await this.serialWriter.write(encodedCommand);
            }
    
            return new Promise((resolve, reject) => {
                const startTime = Date.now();
    
                const checkResponse = () => {
                    if (Date.now() - startTime > timeout) {
                        this.awaitingResponse = null;
                        this.isSendingCommand = false;
                        reject(new Error(`Timeout waiting for response: ${expectedResponse}`));
                        return;
                    }
    
                    if (this.lastResponse && (
                        (typeof expectedResponse === "string" && this.lastResponse.startsWith(expectedResponse)) ||
                        (expectedResponse instanceof RegExp && expectedResponse.test(this.lastResponse))
                    )) {
                        this.awaitingResponse = null;
                        this.isSendingCommand = false;
                        resolve();
                        return;
                    }
    
                    setTimeout(checkResponse, 50);
                };
    
                checkResponse();
            });
        } catch (error) {
            console.error("[sendCommandAndWait] ❌ Error:", error);
        } finally {
            this.isSendingCommand = false;
        }
    }
    

    handleData(message) {
        if (!message || message.trim().length === 0) {
            console.warn("[handleData] ⚠️ Ignoring empty message");
            return;
        }

        message = message.trim();
        console.log("[handleData] 📥 Received:", message);

        this.lastResponse = message;

        // --- Mode Handling ---
        if (message.startsWith("MODE")) {
            this.buggyState.mode = message.split(":")[1].trim();
            this.isReadingParams = false;
            if (this.awaitingResponse === "MODE") this.awaitingResponse = null;
        } 
        // --- Parameter Handling ---
        else if (message.startsWith("PARAMETERS:")) {
            this.isReadingParams = true;
            this.tempParams = {};
        } 
        else if (message.startsWith("PARAMETERS_DONE")) {
            this.isReadingParams = false;
            this.buggyState.parameters = { ...this.tempParams };
            console.log("✅ Parameters saved:", this.buggyState.parameters);
            if (this.awaitingResponse === "PARAMETERS") this.awaitingResponse = null;
        } 
        else if (this.isReadingParams) {
            this.extractParameters(message);
        } 
        // --- Update Confirmation ---
        else if (message.startsWith("Updated:")) {
            this.extractUpdatedValues(message);
        } 
        // --- Movement Finished ---
        else if (message === "MOVEMENT FINISHED") {
            console.log("✅ Movement finished!");
            this.isMovementFinished = true;
        } 
        // --- Debug Data Handling ---
        else if (message === "DEBUG DATA:") {
            console.log("📡 Debug data started...");
            this.awaitingDebugData = true;
            this.accumulatedDebugData = [];
        } 
        else if (message === "DEBUG_END") {
            this.processDebugData();
        } 
        else if (this.awaitingDebugData) {
            this.processDebugLine(message);
        } 
        // --- Sensor Data Handling ---
        else if (message.startsWith("SENSOR DATA:")) {
            this.processSensorData(message);
        }
        else if (message.startsWith("MOTOR DATA:")) {
            this.processMotorData(message);
        }
        else {
            console.log("ℹ️ Unhandled message:", message);
        }
    }

    extractParameters(message) {
        const pairs = message.split(",");
        pairs.forEach(pair => {
            const match = pair.trim().match(/(\S+)\s*=\s*(\d+(\.\d+)?)/);
            if (match) {
                this.tempParams[match[1].trim()] = parseFloat(match[2]);
            }
        });
    }

    extractUpdatedValues(message) {
        const match = message.match(/Updated:\s*(\S+)\s*=\s*([\d.]+)/);
        if (match) {
            console.log(`✅ Update confirmed: ${match[1]} = ${match[2]}`);
            if (this.awaitingResponse === `Updated: ${match[1]} = ${match[2]}`) {
                this.awaitingResponse = null;
            }
        }
    }

    processDebugData() {
        console.log("🚀 DEBUG_END received, processing debug data:", this.accumulatedDebugData);
        this.awaitingDebugData = false;
        document.dispatchEvent(new CustomEvent("updateDebugTable", { detail: this.accumulatedDebugData }));
        document.dispatchEvent(new Event("fetchState"));
    }

    processDebugLine(message) {
        if (!message.trim()) {
            console.warn("⚠️ Ignoring blank debug message");
            return;
        }

        const debugLine = this.parseDebugLine(message);
        if (debugLine && Object.keys(debugLine).length > 0) {
            this.accumulatedDebugData.push(debugLine);
        }
    }

    processSensorData(message) {
        console.log("📡 Processing sensor data...");
        const parts = message.replace("SENSOR DATA:", "").trim().split(/\s*\|\s*ERROR:\s*/);
        const sensorValuesPart = parts[0].trim().split(" ");
        const errorValue = parseFloat(parts[1]);

        const timeElapsed = sensorValuesPart.shift();
        const sensorValues = sensorValuesPart.map(val => parseFloat(val));

        const sensorData = { time: timeElapsed, sensors: sensorValues, error: errorValue };
        document.dispatchEvent(new CustomEvent("updateSensorTable", { detail: sensorData }));
    }

    processMotorData(message) {
        console.log("📡 Processing motor data...");
        // Remove "MOTOR DATA:" prefix
        const data = message.replace("MOTOR DATA:", "").trim();
        // Split the data by "|"
        const parts = data.split("|").map(part => part.trim());
        if (parts.length < 3) {
            console.error("Invalid motor data format:", message);
            return;
        }
        // Extract time and motor speeds
        const timeElapsed = parseInt(parts[0]); // Convert timestamp to integer
        const leftSpeed = parseFloat(parts[1].replace("Left Speed:", "").trim()); // Extract left speed
        const rightSpeed = parseFloat(parts[2].replace("Right Speed:", "").trim()); // Extract right speed
        // Create object with parsed values
        const motorData = {
            time: timeElapsed,
            leftSpeed: leftSpeed,
            rightSpeed: rightSpeed
        };
        console.log("🚀 Parsed Motor Data:", motorData);
        // Dispatch event with parsed motor data
        document.dispatchEvent(new CustomEvent("updateMotorTable", { detail: motorData }));
    }
    

    parseDebugLine(line) {
        const debugObj = {};
        const [timePart, keyValuesPart] = line.split(":");

        if (timePart) debugObj.time = timePart.trim();
        if (keyValuesPart) {
            keyValuesPart.split(",").forEach(pair => {
                const [key, value] = pair.split("=");
                if (key && value) debugObj[key.trim()] = value.trim();
            });
        }
        return debugObj;
    }
}

export default DataHandler;
