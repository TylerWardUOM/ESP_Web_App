class ConnectionManager {
    constructor() {
        // Define global state object
        this.listeners = {}; // Custom event system
        this.bleDevices = [];
        this.serialDevices = [];
        this.connectionType = null;
        this.isConnected = false;
        this.bleCharacteristic = null;
        this.serialPort = null;
        this.serialReader = null;
        this.serialWriter = null;
        this.buffer = "";
        this.isReadingParams = false;
        this.awaitingDebugData = false;
        this.accumulatedDebugData = [];
        this.tempParams = {};
        this.buggyState = { mode: "", parameters: {} };
        this.lastRunMode = null; 
        this.lastRunParameters = {}; 
    }

    // Add a listener for a specific event
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    // Emit an event to notify listeners
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    off(event, callback) {
        if (!this.listeners[event]) return;
    
        this.listeners[event] = this.listeners[event].filter(listener => listener !== callback);
    }
    

    async scanBLE() {
        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: [0xFFE0] }  
                ]
            });
    
            if (device) {
                console.log("✅ Bluetooth device selected:", device.name);
                await this.connectBLE(device);
            } else {
                console.log("⚠️ No compatible device selected.");
            }
        } catch (error) {
            console.error("❌ Bluetooth scan failed:", error);
        }
    }
    
    
    async scanSerial() {
        try {
            // Prompt the user to select a serial port
            const port = await navigator.serial.requestPort();
            if (port) {
                console.log("Serial port selected:", port);
                await this.connectSerial(port);
            } else {
                console.log("No serial port selected.");
            }
        } catch (error) {
            console.error("Serial scan failed:", error);
        }
    }


    async connectBLE(device) {
        const status = document.getElementById("connection-status");
        status.innerText = "🔄 Connecting via Bluetooth...";
        status.style.color = "black"; // Default color during connection attempt
    
        try {
            const server = await device.gatt.connect();
            status.innerText = "🔄 Connected to device, discovering services...";
        
            const service = await server.getPrimaryService(0xFFE0);
            this.bleCharacteristic = await service.getCharacteristic(0xFFE1);
        
            // ✅ Start reading BLE data
            await this.readBLE();
        
            this.isConnected = true;
            status.innerText = "✅ Connected via Bluetooth!";
            status.style.color = "green"; // Set text to green on successful connection
            this.connectionType = "ble"
        } catch (error) {
            console.error("BLE Connection Error:", error);
            status.innerText = "❌ Bluetooth Connection Failed.";
            status.style.color = "#d9534f"; // Set text to red on error
        }
    }


    async readBLE() {
        console.log("[readBLE] 📡 Setting up BLE Read Listener...");
    
        if (!this.bleCharacteristic) {
            console.error("[readBLE] ❌ No BLE characteristic found.");
            return;
        }
    
        const decoder = new TextDecoder();
        this.buffer = ""; // Ensure buffer is initialized
    
        this.bleCharacteristic.addEventListener("characteristicvaluechanged", (event) => {
            let byteArray = new Uint8Array(event.target.value.buffer);
            let receivedData = decoder.decode(byteArray, { stream: true });
    
            console.log("[readBLE] 📥 Raw Data:", receivedData);
    
            // Accumulate data and process complete messages
            this.buffer += receivedData;
            let messages = this.buffer.split("\n");
            while (messages.length > 1) {
                let message = messages.shift().trim();
                console.log("[readBLE] 📥 Full message received:", message);
                this.handleData(message);  // ✅ Consistent with readSerial
                this.emit("dataReceived", message);
            }
            this.buffer = messages[0] || "";
        });
    
        await this.bleCharacteristic.startNotifications();
        console.log("[readBLE] ✅ Listening for BLE notifications...");
    }
    
    async connectSerial(port) {
        const status = document.getElementById("connection-status");
        status.innerText = "🔄 Connecting via Serial...";
        status.style.color = "black"; // Default color during connection attempt
    
        try {
            this.serialPort = port;
            await this.serialPort.open({ baudRate: 9600 });
    
            this.serialReader = this.serialPort.readable?.getReader();
            this.serialWriter = this.serialPort.writable?.getWriter();
    
            console.log("[connectSerial] ✅ Serial connection established. Starting read...");
            status.innerText = "🔄 Connected to serial device, starting data read...";
        
            if (!this.serialReader) {
                console.error("[connectSerial] ❌ Serial reader not available.");
                status.innerText = "❌ Serial Connection Failed: No reader available.";
                status.style.color = "#d9534f"; // Set text to red on error
                return;
            }
    
            this.readSerial(); // Start reading data
            this.isConnected = true;
            status.innerText = "✅ Connected via Serial!";
            status.style.color = "green"; // Set text to green on successful connection
            this.connectionType = "serial"
        } catch (error) {
            console.error("[connectSerial] ❌ Serial Connection Error:", error);
            status.innerText = "❌ Serial Connection Failed.";
            status.style.color = "#d9534f"; // Set text to red on error
        }
    }
    
    
    async readSerial() {
        const decoder = new TextDecoder();
        console.log("[readSerial] 📡 Setting up Serial Read Listener...");
    
        if (!this.serialPort || !this.serialPort.readable) {
            console.error("[readSerial] ❌ No readable serial port found.");
            return;
        }
    
        // ✅ Release any existing reader before creating a new one
        if (this.serialReader) {
            console.log("[readSerial] 🔄 Releasing previous serial reader...");
            try {
                await this.serialReader.cancel();
                this.serialReader.releaseLock();
            } catch (error) {
                console.warn("[readSerial] ⚠️ Error releasing previous reader:", error);
            }
        }
    
        // ✅ Get a new reader
        this.serialReader = this.serialPort.readable.getReader();
        let receivedData = "";
    
        try {
            while (this.isConnected) {
                const { value, done } = await this.serialReader.read();
    
                if (done) {
                    console.log("[readSerial] ⏹️ Serial read stopped.");
                    break;
                }
    
                if (value) {
                    // ✅ Ensure `value` is a Uint8Array
                    let byteArray = new Uint8Array(value);
    
                    // ✅ Decode properly using streaming mode
                    let decodedValue = decoder.decode(byteArray, { stream: true });
    
                    receivedData += decodedValue;
    
                    // ✅ Process complete messages (split by newline)
                    let messages = receivedData.split("\n");
                    while (messages.length > 1) {
                        let message = messages.shift().trim();
                        console.log("[readSerial] 📥 Full message received:", message);
                        this.handleData(message);
                        this.emit("dataReceived", message);
                    }
                    receivedData = messages[0] || "";
                }
            }
        } catch (error) {
            console.error("[readSerial] ❌ Serial read error:", error);
        } finally {
            console.log("[readSerial] 🔄 Releasing serial reader...");
            this.serialReader.releaseLock();
        }
    }
    

    async sendCommandAndWait(command, expectedResponse, timeout = 5000) {
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
            let encodedCommand = new TextEncoder().encode(command + "\n");
            const maxChunkSize = 20; // HM-10 Limit
    
            console.log(`[sendCommandAndWait] 📤 Sending command: "${command}" (Total size: ${encodedCommand.length} bytes)`);
    
            if (this.bleCharacteristic) {
                for (let i = 0; i < encodedCommand.length; i += maxChunkSize) {
                    let chunk = encodedCommand.slice(i, i + maxChunkSize);
                    console.log(`[sendCommandAndWait] 📤 Sending chunk: ${new TextDecoder().decode(chunk)}`);
                    await this.bleCharacteristic.writeValue(chunk);
                    await new Promise(resolve => setTimeout(resolve, 50)); // Short delay to prevent overflow
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

    async disconnect() {
        console.log("[disconnect] Begin Disconnect");
        const status = document.getElementById("connection-status");
        
        console.log(`[disconnect] Current Connection Type: ${this.connectionType}`);
    
        try {
            if (this.connectionType === "ble") {
                console.log("[disconnect] BLE mode detected.");
                
                if (this.bleCharacteristic) {
                    let device = this.bleCharacteristic.service.device;
                    
                    if (device && device.gatt && device.gatt.connected) {
                        console.log("[disconnect] 🔄 Forcing BLE disconnection...");
                        device.gatt.disconnect();
                    } else {
                        console.warn("[disconnect] ⚠️ BLE device already disconnected or not found.");
                    }
    
                    if (this.bleEventListener) {
                        console.log("[disconnect] Removing BLE event listener...");
                        this.bleCharacteristic.removeEventListener("characteristicvaluechanged", this.bleEventListener);
                        this.bleEventListener = null;
                    }
    
                    this.bleCharacteristic = null;
                    console.log("[disconnect] ✅ BLE Disconnected.");
                } else {
                    console.warn("[disconnect] ⚠️ No BLE characteristic found.");
                }
            } 
            
            else if (this.connectionType === "serial") {
                console.log("[disconnect] Serial mode detected.");
                
                if (this.serialPort) {
                    console.log("[disconnect] 🔄 Disconnecting Serial...");
    
                    if (this.serialReader) {
                        console.log("[disconnect] Canceling Serial Reader...");
                        await this.serialReader.cancel().catch(err => console.error("[disconnect] ❌ Error canceling serial reader:", err));
                        this.serialReader.releaseLock();
                        this.serialReader = null;
                    }
    
                    if (this.serialWriter) {
                        console.log("[disconnect] Closing Serial Writer...");
                        await this.serialWriter.close().catch(err => console.error("[disconnect] ❌ Error closing serial writer:", err));
    
                        if (this.serialWriter.releaseLock) {
                            this.serialWriter.releaseLock();
                        }
                        this.serialWriter = null;
                    }
    
                    console.log("[disconnect] Closing Serial Port...");
                    await this.serialPort.close().catch(err => console.error("[disconnect] ❌ Error closing serial port:", err));
    
                    if (navigator.serial && navigator.serial.forget) {
                        try {
                            await navigator.serial.forget(this.serialPort);
                            console.log("[disconnect] 🔄 Serial device forgotten.");
                        } catch (error) {
                            console.warn("[disconnect] ⚠️ Could not revoke serial device permissions:", error);
                        }
                    }
    
                    this.serialPort = null;
                    console.log("[disconnect] ✅ Serial Disconnected.");
                } else {
                    console.warn("[disconnect] ⚠️ No Serial port found.");
                }
            } 
            
            else {
                console.warn("[disconnect] ⚠️ No connection type detected. Already disconnected?");
            }
    
            // Reset state and update UI status
            this.isConnected = false;
            this.connectionType = null;
            status.innerText = "Not Connected";
            status.style.color = "#d9534f"; 
            console.log("[disconnect] UI updated to Not Connected.");
    
        } catch (error) {
            console.error("[disconnect] ❌ Error disconnecting:", error);
            status.innerText = "⚠️ Disconnect Error";
            status.style.color = "#d9534f"; 
        }
    }
    

}

export default ConnectionManager;