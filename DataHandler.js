class DataHandler {
    constructor() {
        this.isSendingCommand = false;
        this.awaitingResponse = null;
        this.lastResponse = null;
        this.awaitingDebugData = false;
        this.accumulatedDebugData = [];
        this.isReadingParams = false;
        this.tempParams = {};
        this.buggyState = { mode: "", parameters: {} };
        this.connection = null; 
        this.connectionType = null;
    }

    setConnection(connection,connectionType) {
        this.connection = connection;
        this.connectionType = connectionType;
    }

    async sendCommandAndWait(command, expectedResponse, type, timeout = 5000) {
        if (!this.isConnected) {
            console.warn("[sendCommandAndWait] ⚠️ Not connected!");
            return;
        }
    
        if (this.isSendingCommand) {
            console.warn("[sendCommandAndWait] ⏳ GATT operation in progress. Try again later.");
            return;
        }
    
        this.isSendingCommand = true;
        this.awaitingResponse = expectedResponse;
        this.lastResponse = null;
    
        try {
            if (type === "ble") {
                await this.sendCommandToBLE(command);
            } else if (type === "serial") {
                await this.sendCommandToSerial(command);
            } else {
                console.error(`[sendCommandAndWait] ❌ Invalid connection type: ${type}`);
                return;
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

    waitForResponse(expectedResponse) {
        return new Promise((resolve) => {
            const checkResponse = () => {
                if (this.lastResponse && (
                    (typeof expectedResponse === "string" && this.lastResponse.startsWith(expectedResponse)) ||
                    (expectedResponse instanceof RegExp && expectedResponse.test(this.lastResponse))
                )) {
                    resolve();
                } else {
                    setTimeout(checkResponse, 50);
                }
            };
            checkResponse();
        });
    }

    timeoutPromise(ms, message) {
        return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
    }

    handleData(message) {
        if (!message || message.trim().length === 0) {
            console.warn("[handleData] ⚠️ Ignoring empty message");
            return;
        }

        message = message.trim();
        console.log("[handleData] 📥 Received:", message);

        this.lastResponse = message;

        if (message.startsWith("MODE:")) {
            this.buggyState.mode = message.split(":")[1].trim();
            this.isReadingParams = false;
        } else if (message.startsWith("PARAMETERS:")) {
            this.isReadingParams = true;
            this.tempParams = {};
        } else if (message.startsWith("PARAMETERS_DONE")) {
            this.isReadingParams = false;
            this.buggyState.parameters = { ...this.tempParams };
            console.log("✅ Parameters saved:", this.buggyState.parameters);
        } else if (this.isReadingParams) {
            this.extractParameters(message);
        } else if (message.startsWith("Updated:")) {
            this.extractUpdatedValues(message);
        } else if (message === "MOVEMENT FINISHED") {
            console.log("✅ Movement finished!");
        } else if (message === "DEBUG DATA:") {
            this.awaitingDebugData = true;
            this.accumulatedDebugData = [];
        } else if (message === "DEBUG_END") {
            this.processDebugData();
        } else if (this.awaitingDebugData) {
            this.processDebugLine(message);
        } else if (message.startsWith("SENSOR DATA:")) {
            this.processSensorData(message);
        } else {
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
