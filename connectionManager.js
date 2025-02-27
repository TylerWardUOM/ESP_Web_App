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
        
        try {
            const server = await device.gatt.connect();
            status.innerText = "🔄 Connected to device, discovering services...";
    
            const services = await server.getPrimaryServices();
            for (const service of services) {
                console.log("Service UUID:", service.uuid);
                const characteristics = await service.getCharacteristics();
                for (const characteristic of characteristics) {
                    console.log("  Characteristic UUID:", characteristic.uuid);
                }
            }
    
            status.innerText = "🔄 Finding communication service...";
            const service = await server.getPrimaryService(0xFFE0);
            this.bleCharacteristic = await service.getCharacteristic(0xFFE1);
    
            this.bleCharacteristic.addEventListener("characteristicvaluechanged", this.handleData.bind(this));
            await this.bleCharacteristic.startNotifications();
    
            this.isConnected = true;
            status.innerText = "✅ Connected via Bluetooth!";
        } catch (error) {
            console.error("BLE Connection Error:", error);
            status.innerText = "❌ Bluetooth Connection Failed.";
        }
    }
    
    

    async connectSerial(port) {
        try {
            this.serialPort = port;
            await this.serialPort.open({ baudRate: 9600 });
    
            this.serialReader = this.serialPort.readable?.getReader();
            this.serialWriter = this.serialPort.writable?.getWriter();
    
            console.log("[connectSerial] ✅ Serial connection established. Starting read...");
            
            if (!this.serialReader) {
                console.error("[connectSerial] ❌ Serial reader not available.");
                return;
            }
    
            this.readSerial(); // Start reading
            this.isConnected = true;
        } catch (error) {
            console.error("[connectSerial] ❌ Serial Connection Error:", error);
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
        // Ensure message is a trimmed string
        message = message.trim();
        console.log("[handleData] 📥 Received:", message);

        this.lastResponse = message;
        
        if (message.startsWith("MODE:")) {
            // Update state with the mode
            this.buggyState.mode = message.split(":")[1].trim();
            this.isReadingParams = false; // Stop reading parameters
            // If we were waiting for a MODE response, clear the flag
            if (this.awaitingResponse === "MODE") {
                this.awaitingResponse = null;
            }
        } 
        else if (message.startsWith("PARAMETERS:")) {
            // Start capturing parameters
            this.isReadingParams = true;
            this.tempParams = {}; // Reset temporary storage
        } 
        else if (message.startsWith("PARAMETERS_DONE")) {
            // End of parameters block; process and save parameters
            this.isReadingParams = false;
            this.buggyState.parameters = { ...this.tempParams };
            console.log("✅ Parameters received and saved:", this.buggyState.parameters);
            // If we were waiting for PARAMETERS to complete, clear the flag
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

        else if (message.startsWith("Updated:")) {
            const match = message.match(/Updated:\s*(\S+)\s*=\s*([\d.]+)/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                console.log(`✅ Update confirmed: ${key} = ${value}`);
                if (this.awaitingResponse === `Updated: ${key} = ${value}`) {
                    this.awaitingResponse = `Updated: ${key} = ${value}`;
                }
            }
        }
        // You can add further processing for other message types here if needed.
    }
    
    

    parseDebugLine(line) {
        const debugObj = {};
        const parts = line.split(":");
        if (parts.length < 2) return null;
        debugObj.time = parts[0].trim();
        const keyValuesPart = parts.slice(1).join(":");
        const pairs = keyValuesPart.split(",").map(pair => pair.trim());
        pairs.forEach(pair => {
            const [key, value] = pair.split("=");
            if (key && value) {
                debugObj[key.trim()] = value.trim();
            }
        });
        return debugObj;
    }

    async disconnect() {
        if (this.connectionType === "ble" && this.bleCharacteristic) {
            try {
                await this.bleCharacteristic.stopNotifications();
                this.bleCharacteristic.removeEventListener("characteristicvaluechanged", this.handleData.bind(this));
                this.bleCharacteristic.service.device.gatt.disconnect();
                console.log("Disconnected from BLE device.");
            } catch (error) {
                console.error("Error disconnecting BLE:", error);
            }
        } else if (this.connectionType === "serial" && this.serialPort) {
            try {
                await this.serialReader.cancel();
                await this.serialWriter.close();
                await this.serialPort.close();
                console.log("Disconnected from Serial device.");
            } catch (error) {
                console.error("Error disconnecting Serial:", error);
            }
        }
        this.isConnected = false;
        this.connectionType = null;
        const status = document.getElementById("connection-status");
        status.innerText = "Not Connected"
    }

}

const connectionManager = new ConnectionManager();

// Fetch state on page load
window.onload = async function () {
    console.log("Page loaded");
};

// Function to handle device selection UI
function showConnectionOptions() {
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

    document.getElementById("device-selection-modal").style.display = "block";
}

function handleConnectionSuccess() {
    if (connectionManager.isConnected) {
        document.getElementById("device-selection-modal").style.display = "none";
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
function disconnectDevice() {
    console.log("Disconnecting from device");
    connectionManager.disconnect();
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
        paramRow.innerHTML = `<label>${key}: </label><input type="text" id="param-${key}" value="${value}" data-initial="${value}">`;
        paramDiv.appendChild(paramRow);
    });
}

// Update parameters only if changed and wait for confirmation
async function updateParameters() {
    console.log("Checking for parameter updates");
    const paramInputs = document.querySelectorAll("#parameters input");
    let updates = [];

    paramInputs.forEach(input => {
        const key = input.id.replace("param-", ""); // Remove "param-" prefix
        const newValue = input.value.trim();
        const initialValue = input.getAttribute("data-initial"); // Get stored initial value

        // Convert values to number if applicable
        const parsedValue = isNaN(newValue) ? newValue : parseFloat(newValue);
        const parsedInitialValue = isNaN(initialValue) ? initialValue : parseFloat(initialValue);

        // Check if value has changed
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
            // Use sendCommandAndWait to send the command and wait for confirmation
            await connectionManager.sendCommandAndWait(`PARAM:${key}=${value}`, new RegExp(`Updated:\\s*${key}\\s*=\\s*${value}`), 5000);
            console.log(`✅ Confirmed update for ${key}=${value}`);
        } catch (error) {
            console.error(`❌ Error updating ${key}:`, error);
            alert(`Failed to update ${key}`);
            return; // Stop sending further updates if one fails
        }
    }

    alert("All parameters updated!");
    fetchState(); // Refresh state after updating parameters
}



// Function to start movement when the GO button is pressed
function startBuggy() {
    console.log("Starting buggy movement");
    disableUI();
    document.getElementById("mode").innerText = "waiting_for_movement";
    connectionManager.sendCommand("GO");
}

// Disable UI controls during movement
function disableUI() {
    console.log("Disabling UI controls");
    document.querySelectorAll('input, button').forEach(control => control.disabled = true);
}

// Enable UI controls after movement finishes
function enableUI() {
    console.log("Enabling UI controls");
    document.querySelectorAll('input, button').forEach(control => control.disabled = false);
}

// Function to handle the mode change when the button is clicked
async function changeMode() {
    if (!connectionManager.isConnected) {
        alert("Please connect to a device first.");
        return;
    }

    const selectedMode = document.getElementById("modeSelect").value;
    console.log(`Changing mode to: ${selectedMode}`);

    try {
        // Wait for confirmation that mode has changed
        await connectionManager.sendCommandAndWait(`SET_MODE:${selectedMode}`, new RegExp(`MODE_CHANGED:${selectedMode}`), 5000);
        console.log(`✅ Mode changed to ${selectedMode}`);
    } catch (error) {
        console.error(`❌ Error changing mode:`, error);
        alert(`Failed to change mode`);
        return;
    }

    fetchState(); // Fetch the latest state after mode change
}

// Function to update the UI with new debug data
function updateDebugDataUI(data) {
    console.log("Updating UI with debug data:", data);
    const debugDiv = document.getElementById("debugData");
    debugDiv.innerHTML = "";
    data.forEach(entry => {
        const debugRow = document.createElement("div");
        debugRow.textContent = JSON.stringify(entry);
        debugDiv.appendChild(debugRow);
    });
}

// Listen for messages from the buggy
connectionManager.onMessageReceived = (message) => {
    console.log("Received message from buggy:", message);
    if (message.includes("MOVEMENT FINISHED")) {
        console.log("Movement finished detected");
        enableUI();
        fetchState(); // Fetch state when movement is completed
    } else if (message.startsWith("DEBUG DATA:")) {
        console.log("Debug data detected, fetching debug data");
        fetchDebugData(); // Fetch debug data if signaled
    }
};

// Fetch debug data when movement finishes
function fetchDebugData() {
    console.log("Fetching debug data from server");
    fetch("/debug-data")
        .then(response => response.json())
        .then(data => updateDebugDataUI(data))
        .catch(error => console.error("Error fetching debug data:", error));
}