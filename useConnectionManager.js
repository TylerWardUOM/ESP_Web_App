import { useState, useEffect, useCallback } from "react";

export default function useConnectionManager() {
    const [connectionType, setConnectionType] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [bleCharacteristic, setBleCharacteristic] = useState(null);
    const [serialPort, setSerialPort] = useState(null);
    const [serialReader, setSerialReader] = useState(null);
    const [serialWriter, setSerialWriter] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState("disconnected");
    const [receivedData, setReceivedData] = useState([]);

    // 🔹 Scan for BLE Devices
    const scanBLE = async () => {
        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: [0xFFE0] }]
            });
            if (device) {
                console.log("✅ Bluetooth device selected:", device.name);
                await connectBLE(device);
            }
        } catch (error) {
            console.error("❌ Bluetooth scan failed:", error);
        }
    };

    // 🔹 Scan for Serial Devices
    const scanSerial = async () => {
        try {
            const port = await navigator.serial.requestPort();
            if (port) {
                console.log("✅ Serial port selected:", port);
                await connectSerial(port);
            }
        } catch (error) {
            console.error("❌ Serial scan failed:", error);
        }
    };

    // 🔹 Connect to BLE Device
    const connectBLE = async (device) => {
        setConnectionStatus("connecting");
        try {
            const server = await device.gatt.connect();
            const service = await server.getPrimaryService(0xFFE0);
            const characteristic = await service.getCharacteristic(0xFFE1);

            setBleCharacteristic(characteristic);
            setConnectionType("ble");
            setIsConnected(true);
            setConnectionStatus("connected");

            await readBLE(characteristic);
        } catch (error) {
            console.error("❌ BLE Connection Error:", error);
            setConnectionStatus("failed");
        }
    };

    // 🔹 Read BLE Data
    const readBLE = async (characteristic) => {
        console.log("[readBLE] 📡 Setting up BLE Read Listener...");
        if (!characteristic) return;

        const decoder = new TextDecoder();
        let buffer = "";

        characteristic.addEventListener("characteristicvaluechanged", (event) => {
            let byteArray = new Uint8Array(event.target.value.buffer);
            let receivedData = decoder.decode(byteArray, { stream: true });

            buffer += receivedData;
            let messages = buffer.split("\n");
            while (messages.length > 1) {
                let message = messages.shift().trim();
                console.log("[readBLE] 📥 Full message received:", message);
                setReceivedData((prev) => [...prev, message]);
            }
            buffer = messages[0] || "";
        });

        await characteristic.startNotifications();
        console.log("[readBLE] ✅ Listening for BLE notifications...");
    };

    // 🔹 Connect to Serial Device
    const connectSerial = async (port) => {
        setConnectionStatus("connecting");
        try {
            await port.open({ baudRate: 9600 });
            const reader = port.readable.getReader();
            const writer = port.writable.getWriter();

            setSerialPort(port);
            setSerialReader(reader);
            setSerialWriter(writer);
            setConnectionType("serial");
            setIsConnected(true);
            setConnectionStatus("connected");

            readSerial(reader);
        } catch (error) {
            console.error("❌ Serial Connection Error:", error);
            setConnectionStatus("failed");
        }
    };

    // 🔹 Read Serial Data
    const readSerial = async (reader) => {
        console.log("[readSerial] 📡 Setting up Serial Read Listener...");
        const decoder = new TextDecoder();
        let receivedData = "";

        try {
            while (isConnected) {
                const { value, done } = await reader.read();
                if (done) break;

                if (value) {
                    let decodedValue = decoder.decode(new Uint8Array(value), { stream: true });
                    receivedData += decodedValue;

                    let messages = receivedData.split("\n");
                    while (messages.length > 1) {
                        let message = messages.shift().trim();
                        console.log("[readSerial] 📥 Full message received:", message);
                        setReceivedData((prev) => [...prev, message]);
                    }
                    receivedData = messages[0] || "";
                }
            }
        } catch (error) {
            console.error("❌ Serial read error:", error);
        }
    };

    // 🔹 Disconnect
    const disconnect = async () => {
        console.log("[disconnect] 🔄 Disconnecting...");
        setConnectionStatus("disconnecting");

        try {
            if (connectionType === "ble" && bleCharacteristic) {
                const device = bleCharacteristic.service.device;
                if (device?.gatt?.connected) {
                    device.gatt.disconnect();
                }
                setBleCharacteristic(null);
            }

            if (connectionType === "serial" && serialPort) {
                if (serialReader) {
                    await serialReader.cancel();
                    serialReader.releaseLock();
                    setSerialReader(null);
                }
                if (serialWriter) {
                    await serialWriter.close();
                    serialWriter.releaseLock();
                    setSerialWriter(null);
                }
                await serialPort.close();
                setSerialPort(null);
            }

            setIsConnected(false);
            setConnectionType(null);
            setConnectionStatus("disconnected");
            console.log("[disconnect] ✅ Disconnected successfully.");
        } catch (error) {
            console.error("[disconnect] ❌ Error disconnecting:", error);
        }
    };

    return {
        connectionType,
        isConnected,
        connectionStatus,
        receivedData,
        scanBLE,
        scanSerial,
        disconnect,
    };
}
