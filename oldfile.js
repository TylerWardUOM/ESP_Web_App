handleData(message) {
    if (!message || message.trim().length === 0) {
        console.warn("[parseDebugLine] Ignoring empty or whitespace-only line");
        return null; // Ignore empty lines, including lines with only \n
    }
    // Ensure message is a trimmed string
    message = message.trim();
    console.log("[handleData] 📥 Received:", message);

    // Save the latest message for any waiting logic
    this.lastResponse = message;

    // --- Mode Handling ---
    if (message.startsWith("MODE:")) {
        this.buggyState.mode = message.split(":")[1].trim();
        this.isReadingParams = false; // Stop reading parameters
        if (this.awaitingResponse === "MODE") {
            this.awaitingResponse = null;
        }
    } 
    // --- Parameter Handling ---
    else if (message.startsWith("PARAMETERS:")) {
        this.isReadingParams = true;
        this.tempParams = {}; // Reset temporary storage
    } 
    else if (message.startsWith("PARAMETERS_DONE")) {
        this.isReadingParams = false;
        this.buggyState.parameters = { ...this.tempParams };
        console.log("✅ Parameters received and saved:", this.buggyState.parameters);
        if (this.awaitingResponse === "PARAMETERS") {
            this.awaitingResponse = null;
        }
    } 
    else if (this.isReadingParams) {
        // Handle parameter lines: they might contain multiple key-value pairs separated by commas
        const pairs = message.split(",");
        pairs.forEach(pair => {
            const match = pair.trim().match(/(\S+)\s*=\s*(\d+(\.\d+)?)/);
            if (match) {
                this.tempParams[match[1].trim()] = parseFloat(match[2]);
            }
        });
    } 
    // --- Update Confirmation Handling ---
    else if (message.startsWith("Updated:")) {
        const match = message.match(/Updated:\s*(\S+)\s*=\s*([\d.]+)/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            console.log(`✅ Update confirmed: ${key} = ${value}`);
            if (this.awaitingResponse === `Updated: ${key} = ${value}`) {
                this.awaitingResponse = null;
            }
        }
    } 
    // --- Debug Data Handling ---
    else if (message === "MOVEMENT FINISHED") {
        console.log("✅ Movement finished!");
        this.isMovementFinished = true;
    } 
    else if (message === "DEBUG DATA:") {
        console.log("📡 Debug data started, awaiting more lines...");
        this.awaitingDebugData = true;
        this.accumulatedDebugData = []; // Reset previous debug data
    } 
    else if (message === "DEBUG_END") {
        console.log("🚀 DEBUG_END received, processing debug data:", this.accumulatedDebugData);
        this.awaitingDebugData = false;
        // Now update the debug UI with the collected data
        // Dispatch event for `updateDebugTable`
        document.dispatchEvent(new CustomEvent("updateDebugTable", { detail: this.accumulatedDebugData }));
        
        // Dispatch event for `fetchState`
        document.dispatchEvent(new Event("fetchState"));
    } 
    else if (this.awaitingDebugData) {
        if (!message.trim()) {
            console.warn("⚠️ Ignoring blank debug message");
            return;
        }
    
        const debugLine = this.parseDebugLine(message);
        
        if (debugLine && Object.keys(debugLine).length > 0) { 
            console.log("➕ Adding debug data:", debugLine);
            this.accumulatedDebugData.push(debugLine);
        } else {
            console.warn("⚠️ Ignoring empty debug line");
        }
    }
    // --- Sensor Data Handling ---
    else if (message.startsWith("SENSOR DATA:")) {
        console.log("📡 Sensor data detected, updating UI...");

        // Extract sensor data
        const parts = message.replace("SENSOR DATA:", "").trim().split(/\s*\|\s*ERROR:\s*/);
        const sensorValuesPart = parts[0].trim().split(" "); // Left side of "| ERROR:"
        const errorValue = parseFloat(parts[1]); // Right side of "| ERROR:"

        // Extract timestamp
        const timeElapsed = sensorValuesPart.shift(); // First value is the timestamp
        const sensorValues = sensorValuesPart.map(val => parseFloat(val)); // Convert sensor values;

        // Create a sensor data object
        const sensorData = {
            time: timeElapsed,
            sensors: sensorValues,
            error: parseFloat(errorValue)
        };

        // Dispatch event for UI update
        document.dispatchEvent(new CustomEvent("updateSensorTable", { detail: sensorData }));
    } 
    else {
        console.log("ℹ️ Unhandled message:", message);
    }
}

parseDebugLine(line) {

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
