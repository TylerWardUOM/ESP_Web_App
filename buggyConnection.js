import { device } from "./Device.js";
import Connection_Status_UIHandler from "./StatusUiHandler.js"

const connection_status_uiHandler = new Connection_Status_UIHandler();
// Subscribe to events
device.connectionManager.on("connectionStatus", (status) => {
    connection_status_uiHandler.updateConnectionStatus(status.type, status.status);
});


function showConnectionOptions() {
    document.getElementById("overlay").style.display = "block";
    document.getElementById("device-selection-modal").style.display = "block";

    const container = document.getElementById("device-list");
    container.innerHTML = ""; // Clear previous entries

    const bleButton = document.createElement("button");
    bleButton.innerText = "Connect via Bluetooth";
    bleButton.onclick = async () => {
        await device.scanBLE();
        handleConnectionSuccess();
    };
    container.appendChild(bleButton);

    const serialButton = document.createElement("button");
    serialButton.innerText = "Connect via Serial";
    serialButton.onclick = async () => {
        await device.scanSerial();
        handleConnectionSuccess();
    };
    container.appendChild(serialButton);
}

export function closeModal() {
    document.getElementById("overlay").style.display = "none";
    document.getElementById("device-selection-modal").style.display = "none";
}

function handleConnectionSuccess() {
    if (device.isConnected) {
        closeModal();
        updateConnectionButton();
        document.dispatchEvent(new Event("fetchState"));
    }
}

// Update the UI when connection status changes
function updateConnectionButton() {
    const button = document.getElementById("connectButton");
    if (device.isConnected) {
        button.innerText = "Disconnect";
    } else {
        button.innerText = "Connect to Buggy";
    }
}

export function handleConnectionButtonClick() {
    if (device.isConnected) {
        disconnectDevice();
    } else {
        showConnectionOptions();
    }
}


// Disconnect from the current device
async function disconnectDevice() {
    console.log("Disconnecting from device");
    await device.disconnect();
    updateConnectionButton();
}


