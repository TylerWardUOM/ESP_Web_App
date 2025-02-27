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
    

    async autoScan() {
        this.bleDevices = await this.scanBLE();
        this.serialDevices = await this.scanSerial();

        if (this.bleDevices.length === 0 && this.serialDevices.length === 0) {
            alert("No devices found.");
            return;
        }

        this.showDeviceSelectionUI();
    }

    async scanBLE() {
        try {
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [0xFFE0]
            });
    
            if (device) {
                console.log("Bluetooth device selected:", device.name);
                await this.connectBLE(device);
            } else {
                console.log("No device selected.");
            }
        } catch (error) {
            console.error("Bluetooth scan failed:", error);
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

    showDeviceSelectionUI() {
        const container = document.getElementById("device-list");
        container.innerHTML = ""; // Clear previous entries

        [...this.bleDevices, ...this.serialDevices].forEach((device, index) => {
            const button = document.createElement("button");
            button.innerText = device.name || `Serial Port ${index + 1}`;
            button.onclick = () => this.connectDevice(device);
            container.appendChild(button);
        });

        document.getElementById("device-selection-modal").style.display = "block"; // Show modal
    }

    async connectDevice(device) {
        document.getElementById("device-selection-modal").style.display = "none"; // Hide modal

        if (this.bleDevices.includes(device)) {
            this.connectionType = "ble";
            await this.connectBLE(device);
        } else {
            this.connectionType = "serial";
            await this.connectSerial(device);
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
        } catch (error) {
            console.error("BLE Connection Error:", error);
            status.innerText = "❌ Bluetooth Connection Failed.";
            status.style.color = "red"; // Set text to red on error
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
                status.style.color = "red"; // Set text to red on error
                return;
            }
    
            this.readSerial(); // Start reading data
            this.isConnected = true;
            status.innerText = "✅ Connected via Serial!";
            status.style.color = "green"; // Set text to green on successful connection
        } catch (error) {
            console.error("[connectSerial] ❌ Serial Connection Error:", error);
            status.innerText = "❌ Serial Connection Failed.";
            status.style.color = "red"; // Set text to red on error
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
            console.log(`[sendCommandAndWait] 📤 Sending command: "${command}"`);
    
            if (this.bleCharacteristic) {
                await this.bleCharacteristic.writeValue(encodedCommand);
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
            updateDebugTable(this.accumulatedDebugData);
            fetchState();
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
    
        try {
            if (this.connectionType === "ble" && this.bleCharacteristic) {
                let device = this.bleCharacteristic.service.device;
                if (device.gatt.connected) {
                    console.log("[disconnect] 🔄 Forcing BLE disconnection...");
                    device.gatt.disconnect();
                }
                // Remove event listener using stored reference
                if (this.bleEventListener) {
                    this.bleCharacteristic.removeEventListener("characteristicvaluechanged", this.bleEventListener);
                    this.bleEventListener = null;
                }
                // Optionally, you can remove the device from memory here if supported,
                // but note that calling requestDevice may trigger a new device request.
                this.bleCharacteristic = null;
                console.log("[disconnect] ✅ Disconnected from BLE device.");
            } 
            else if (this.connectionType === "serial" && this.serialPort) {
                console.log("[disconnect] 🔄 Disconnecting Serial...");
                if (this.serialReader) {
                    await this.serialReader.cancel();
                    this.serialReader.releaseLock();
                    this.serialReader = null;
                }
                if (this.serialWriter) {
                    await this.serialWriter.close();
                    // Optionally release writer lock if needed
                    if (this.serialWriter.releaseLock) {
                        this.serialWriter.releaseLock();
                    }
                    this.serialWriter = null;
                }
                await this.serialPort.close();
                // If supported, forget the serial port before nulling it out:
                if (navigator.serial && navigator.serial.forget) {
                    try {
                        await navigator.serial.forget(this.serialPort);
                        console.log("[disconnect] 🔄 Serial device forgotten.");
                    } catch (error) {
                        console.warn("[disconnect] ⚠️ Could not revoke serial device permissions:", error);
                    }
                }
                this.serialPort = null;
                console.log("[disconnect] ✅ Disconnected from Serial device.");
            }
    
            // Reset state and update UI status
            this.isConnected = false;
            this.connectionType = null;
            status.innerText = "❌ Not Connected";
        } catch (error) {
            console.error("[disconnect] ❌ Error disconnecting:", error);
            status.innerText = "⚠️ Disconnect Error";
        }
    }
    
    

}

const connectionManager = new ConnectionManager();

// Fetch state on page load
window.onload = async function () {
    console.log("Page loaded");
};

function showConnectionOptions() {
    document.getElementById("overlay").style.display = "block";
    document.getElementById("device-selection-modal").style.display = "block";

    const container = document.getElementById("device-list");
    container.innerHTML = ""; // Clear previous entries

    const bleButton = document.createElement("button");
    bleButton.innerText = "Connect via Bluetooth";
    bleButton.onclick = async () => {
        await connectionManager.scanBLE();
        handleConnectionSuccess();
    };
    container.appendChild(bleButton);

    const serialButton = document.createElement("button");
    serialButton.innerText = "Connect via Serial";
    serialButton.onclick = async () => {
        await connectionManager.scanSerial();
        handleConnectionSuccess();
    };
    container.appendChild(serialButton);
}

function closeModal() {
    document.getElementById("overlay").style.display = "none";
    document.getElementById("device-selection-modal").style.display = "none";
}

function handleConnectionSuccess() {
    if (connectionManager.isConnected) {
        closeModal();
        updateConnectionButton();
        fetchState();
    }
}

// Update the UI when connection status changes
function updateConnectionButton() {
    const button = document.getElementById("connectButton");
    if (connectionManager.isConnected) {
        button.innerText = "Disconnect";
        button.onclick = () => disconnectDevice();
    } else {
        button.innerText = "Connect";
        button.onclick = () => showConnectionOptions();
    }
}

// Disconnect from the current device
async function disconnectDevice() {
    console.log("Disconnecting from device");
    await connectionManager.disconnect();
    updateConnectionButton();
}

async function fetchState() {
    console.log("Fetching state and parameters");

    await connectionManager.sendCommandAndWait("STATE", "MODE:", 5000);
    await connectionManager.sendCommandAndWait("PARAMETER", "PARAMETERS_DONE", 5000);

    updateUI();
}

function updateUI() {
    console.log("Updating UI with state:", connectionManager.buggyState);

    // Update mode
    document.getElementById("mode").innerText = connectionManager.buggyState.mode;

    // Get the parameters div
    const paramDiv = document.getElementById("parameters");
    if (!paramDiv) {
        console.error("❌ ERROR: Parameters div not found!");
        return;
    }

    // Clear the parameter list
    paramDiv.innerHTML = "";

    // Ensure parameters exist before updating UI
    if (!connectionManager.buggyState.parameters || Object.keys(connectionManager.buggyState.parameters).length === 0) {
        console.warn("⚠️ No parameters to display.");
        return;
    }

    console.log("Parameters received:", connectionManager.buggyState.parameters);

    // Store the current parameters state for change detection
    connectionManager.initialParameters = { ...connectionManager.buggyState.parameters };

    // Add input fields for each parameter
    Object.entries(connectionManager.buggyState.parameters).forEach(([key, value]) => {
        console.log(`Adding parameter: ${key} = ${value}`);

        const paramRow = document.createElement("div");
        paramRow.classList.add("parameter-item"); // Add the class for styling

        const input = document.createElement("input");
        input.type = "text";
        input.id = `param-${key}`;
        input.value = value;
        input.dataset.initial = value; // Store initial value for comparison
        input.style.color = "gray"; // Start with gray text

        // Change color when the user edits the field
        input.addEventListener("input", () => {
            input.style.color = (input.value.trim() === input.dataset.initial) ? "gray" : "black";
        });

        const label = document.createElement("label");
        label.innerText = `${key}: `;

        paramRow.appendChild(label);
        paramRow.appendChild(input);
        paramDiv.appendChild(paramRow);
    });
}

async function updateParameters() {
    console.log("Checking for parameter updates");
    const paramInputs = document.querySelectorAll("#parameters input");
    let updates = [];

    paramInputs.forEach(input => {
        const key = input.id.replace("param-", "");
        const newValue = input.value.trim();
        const initialValue = input.dataset.initial;

        const parsedValue = isNaN(newValue) ? newValue : parseFloat(newValue);
        const parsedInitialValue = isNaN(initialValue) ? initialValue : parseFloat(initialValue);

        if (parsedValue !== parsedInitialValue) {
            updates.push({ key, value: parsedValue });
        }
    });

    if (updates.length === 0) {
        console.log("No changes detected in parameters");
        alert("No changes made.");
        return;
    }

    for (const { key, value } of updates) {
        console.log(`Sending parameter update: ${key}=${value}`);

        try {
            await connectionManager.sendCommandAndWait(
                `PARAM:${key}=${value}`,
                new RegExp(`Updated:\\s*${key}\\s*=\\s*${value}`), 
                5000
            );
            console.log(`✅ Confirmed update for ${key}=${value}`);
        } catch (error) {
            console.error(`❌ Error updating ${key}:`, error);
            alert(`Failed to update ${key}`);
            return;
        }
    }

    alert("All parameters updated!");

    // Reset all input colors to gray after update
    paramInputs.forEach(input => {
        input.dataset.initial = input.value; // Update stored initial value
        input.style.color = "gray"; // Reset color
    });

    fetchState();
}


async function startBuggy() {
    console.log("Starting buggy movement");
    document.getElementById("mode").innerText = "waiting_for_movement";

    try {
        await connectionManager.sendCommandAndWait("GO", "STARTING MOVEMENT", 100000);
        console.log("✅ Movement started");
        fetchState();
    } catch (error) {
        console.error("❌ Error starting movement:", error);
        alert("Failed to start movement");
    }
}

async function changeMode() {
    if (!connectionManager.isConnected) {
        alert("Please connect to a device first.");
        return;
    }

    const selectedMode = document.getElementById("modeSelect").value;
    console.log(`Changing mode to: ${selectedMode}`);

    try {
        await connectionManager.sendCommandAndWait(`SET_MODE:${selectedMode}`, new RegExp(`MODE_CHANGED:${selectedMode}`), 5000);
        console.log(`✅ Mode changed to ${selectedMode}`);
    } catch (error) {
        console.error("❌ Error changing mode:", error);
        alert("Failed to change mode");
        return;
    }

    fetchState();
}


connectionManager.onMessageReceived = (message) => {
    console.log("Received message from buggy:", message);
    if (message.includes("MOVEMENT FINISHED")) {
        console.log("Movement finished detected");
        fetchState();
    } else if (message.startsWith("DEBUG DATA:")) {
        console.log("Debug data detected, fetching debug data");
        fetchDebugData();
    }
};

function updateDebugTable(accumulatedDebugData) {
    const table = document.querySelector("#debugTable");
    if (!table) {
        console.error("❌ ERROR: Debug table not found!");
        return;
    }

    const tableHead = table.querySelector("thead");
    const tableBody = table.querySelector("tbody");

    if (!accumulatedDebugData || accumulatedDebugData.length === 0) {
        console.warn("⚠️ No debug data available.");
        tableHead.innerHTML = "<tr><th>No Data</th></tr>";
        tableBody.innerHTML = "";
        return;
    }

    // Extract all unique keys from the received debug data
    const allKeys = new Set();
    accumulatedDebugData.forEach(data => {
        Object.keys(data).forEach(key => allKeys.add(key));
    });

    // Convert Set to an array and sort (optional)
    const headers = Array.from(allKeys);

    // Update Table Headers
    tableHead.innerHTML = "";
    const headerRow = document.createElement("tr");
    headers.forEach(header => {
        const th = document.createElement("th");
        th.textContent = header;
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Update Table Body
    tableBody.innerHTML = "";
    accumulatedDebugData.forEach(data => {
        const row = document.createElement("tr");
        headers.forEach(header => {
            const cell = document.createElement("td");
            cell.textContent = data[header] || ""; // Fill missing values with empty string
            row.appendChild(cell);
        });
        tableBody.appendChild(row);
    });

    fetchState();
}

function downloadDebugCSV(accumulatedDebugData) {
    if (!accumulatedDebugData || accumulatedDebugData.length === 0) {
        console.warn("⚠️ No debug data available to download.");
        alert("No debug data to download.");
        return;
    }

    // Extract all unique keys from the debug data
    const allKeys = new Set();
    accumulatedDebugData.forEach(data => {
        Object.keys(data).forEach(key => allKeys.add(key));
    });

    const headers = Array.from(allKeys);
    let csvContent = headers.join(",") + "\n"; // Create CSV header row

    accumulatedDebugData.forEach(data => {
        let row = headers.map(header => {
            const value = data[header] ?? ""; // Fill missing values with an empty string
            return `"${value.toString().replace(/"/g, '""')}"`; // Escape double quotes
        }).join(",");
        csvContent += row + "\n";
    });

    // Create a Blob and download the file
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `debug_data_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    console.log("📥 Debug data downloaded as CSV.");
}

document.getElementById("downloadDebugBtn").addEventListener("click", () => {
    downloadDebugCSV(connectionManager.accumulatedDebugData);
});

