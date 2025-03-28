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
        this.emit("connectionStatus", { type: "ble", status: "connecting" });

        try {
            const server = await device.gatt.connect();
        
            const service = await server.getPrimaryService(0xFFE0);
            this.bleCharacteristic = await service.getCharacteristic(0xFFE1);
        
            // ✅ Start reading BLE data
            await this.readBLE();
        
            this.isConnected = true;
            this.connectionType = "ble"
            this.emit("connectionStatus", { type: "ble", status: "connected" });
            this.emit("connected");
        } catch (error) {
            console.error("BLE Connection Error:", error);
            this.emit("connectionStatus", { type: "ble", status: "failed" });
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
                this.emit("dataReceived", message);
            }
            this.buffer = messages[0] || "";
        });
    
        await this.bleCharacteristic.startNotifications();
        console.log("[readBLE] ✅ Listening for BLE notifications...");
    }
    
    async connectSerial(port) {
        this.emit("connectionStatus", { type: "serial", status: "connecting" });
        try {
            this.serialPort = port;
            await this.serialPort.open({ baudRate: 9600 });
    
            this.serialReader = this.serialPort.readable?.getReader();
            this.serialWriter = this.serialPort.writable?.getWriter();
    
            console.log("[connectSerial] ✅ Serial connection established. Starting read...");
        
            if (!this.serialReader) {
                throw new Error("Serial reader not available.");
            }
    
            this.readSerial(); // Start reading data
            this.isConnected = true;
            this.connectionType = "serial"
            this.emit("connectionStatus", { type: "serial", status: "connected" });
            this.emit("connected");
        } catch (error) {
            console.error("[connectSerial] ❌ Serial Connection Error:", error);
            this.emit("connectionStatus", { type: "serial", status: "failed" });

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
    
    async disconnect() {
        console.log("[disconnect] Begin Disconnect");        
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
            this.emit("connectionStatus", { type: "disconnect", status: "finished" });
            console.log("[disconnect] UI updated to Not Connected.");
    
        } catch (error) {
            console.error("[disconnect] ❌ Error disconnecting:", error);
            this.emit("connectionStatus", { type: "disconnect", status: "failed" });

        }
    }
}

export default ConnectionManager;