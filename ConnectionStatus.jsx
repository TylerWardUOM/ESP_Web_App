import React from "react";

export default function ConnectionStatus({ type, status }) {
    let message = "Not Connected";
    let color = "#d9534f";

    if (type === "ble") {
        switch (status) {
            case "connecting":
                message = "🔄 Connecting via Bluetooth...";
                color = "black";
                break;
            case "connected":
                message = "✅ Connected via Bluetooth!";
                color = "green";
                break;
            case "failed":
                message = "❌ Bluetooth Connection Failed.";
                break;
        }
    } else if (type === "serial") {
        switch (status) {
            case "connecting":
                message = "🔄 Connecting via Serial...";
                color = "black";
                break;
            case "connected":
                message = "✅ Connected via Serial!";
                color = "green";
                break;
            case "failed":
                message = "❌ Serial Connection Failed.";
                break;
        }
    } else if (type === "disconnect") {
        switch (status) {
            case "finished":
                message = "Not Connected";
                break;
            case "failed":
                message = "⚠️ Disconnect Error";
                break;
        }
    }

    return <p id="connection-status" style={{ color }}>{message}</p>;
}
