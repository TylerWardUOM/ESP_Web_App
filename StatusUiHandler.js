class Connection_Status_UIHandler {
    constructor() {
        this.statusElement = document.getElementById("connection-status");
        this.debugElement = document.getElementById("debug-info");
    }

    updateConnectionStatus(type, status) {
        let message = "";
        let color = "black";

        if (type === "ble") {
            switch (status) {
                case "connecting":
                    message = "🔄 Connecting via Bluetooth...";
                    break;
                case "connected":
                    message = "✅ Connected via Bluetooth!";
                    color = "green";
                    break;
                case "failed":
                    message = "❌ Bluetooth Connection Failed.";
                    color = "#d9534f";
                    break;
            }
        } else if (type === "serial") {
            switch (status) {
                case "connecting":
                    message = "🔄 Connecting via Serial...";
                    break;
                case "connected":
                    message = "✅ Connected via Serial!";
                    color = "green";
                    break;
                case "failed":
                    message = "❌ Serial Connection Failed.";
                    color = "#d9534f";
                    break;
            }
        }
        else if (type === "disconnect") {
            switch (status) {
                case "finished":
                    message = "Not Connected";
                    color = "#d9534f";
                    break;
                case "failed":
                    message = "⚠️ Disconnect Error";
                    color = "#d9534f";
                    break;
            }
        }

        this.setStatus(message, color);
    }

    setStatus(text, color) {
        this.statusElement.innerText = text;
        this.statusElement.style.color = color;
    }
}

export default Connection_Status_UIHandler;
