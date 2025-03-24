import React, { useState } from "react";

function ConnectionModal({ device, onConnect, onDisconnect }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    const showConnectionOptions = () => {
        setIsOpen(true);
    };

    const closeModal = () => {
        setIsOpen(false);
    };

    const handleConnectionSuccess = () => {
        if (device.isConnected) {
            setIsConnected(true);
            closeModal();
            onConnect();
        }
    };

    const connectBLE = async () => {
        await device.scanBLE();
        handleConnectionSuccess();
    };

    const connectSerial = async () => {
        await device.scanSerial();
        handleConnectionSuccess();
    };

    const handleConnectionButtonClick = () => {
        if (isConnected) {
            onDisconnect();
            setIsConnected(false);
        } else {
            showConnectionOptions();
        }
    };

    return (
        <div style={{ textAlign: "center" }}>
            <button onClick={handleConnectionButtonClick}>
                {isConnected ? "Disconnect" : "Connect to Buggy"}
            </button>

            {isOpen && (
                <div
                    style={{
                        position: "fixed",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        background: "white",
                        padding: "20px",
                        boxShadow: "0px 0px 10px rgba(0,0,0,0.2)",
                        textAlign: "center",
                    }}
                >
                    <h3>Select a Device</h3>
                    <button onClick={connectBLE}>Connect via Bluetooth</button>
                    <button onClick={connectSerial}>Connect via Serial</button>
                    <button onClick={closeModal}>Close</button>
                </div>
            )}
        </div>
    );
}

export default ConnectionModal;
