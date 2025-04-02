import {device} from './Device.js';

export async function updateParameters() {
    console.log("Checking for parameter updates");
    const paramInputs = document.querySelectorAll("#parameters input");
    let updates = [];

    paramInputs.forEach(input => {
        const key = input.id.replace("param-", "");

        let newValue;
        let initialValue;

        if (input.type === "checkbox") {
            newValue = input.checked ? 1.0 : 0.0; // ✅ Fix: Checkbox should send 1.0 if checked, 0.0 if unchecked
            initialValue = parseFloat(input.dataset.initial);
        } else {
            newValue = isNaN(input.value) ? input.value.trim() : parseFloat(input.value);
            initialValue = isNaN(input.dataset.initial) ? input.dataset.initial : parseFloat(input.dataset.initial);
        }

        if (newValue !== initialValue) {
            updates.push({ key, value: newValue });
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
            await device.sendCommandAndWait(
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

    paramInputs.forEach(input => {
        input.dataset.initial = input.type === "checkbox" ? (input.checked ? "1.0" : "0.0") : input.value;
        input.style.color = "gray";
    });

    document.dispatchEvent(new Event("fetchState"));
}


export async function startBuggy() {
    console.log("Starting buggy movement");

    // Store the mode and parameters when "GO" is pressed
    device.lastRunMode = device.buggyState.mode;
    device.lastRunParameters = { ...device.buggyState.parameters };

    console.log("📌 Stored mode & parameters for debug:", device.lastRunMode, device.lastRunParameters);

    try {
        await device.sendCommandAndWait("GO", "STARTING MOVEMENT", 100000);
        console.log("✅ Movement started");
    } catch (error) {
        console.error("❌ Error starting movement:", error);
        alert("Failed to start movement");
    }
}


export async function changeMode(selectedMode) {
    if (!device.isConnected) {
        alert("Please connect to a device first.");
        return;
    }

    console.log(`Changing mode to: ${selectedMode}`);

    try {
        await device.sendCommandAndWait(`SET_MODE:${selectedMode}`, new RegExp(`MODE_CHANGED:${selectedMode}`), 5000);
        console.log(`✅ Mode changed to ${selectedMode}`);

        // If sensor debug mode is selected, start fetching sensor data
        if (selectedMode === "SENSOR_DEBUG") {
            document.dispatchEvent(new Event("startSensorDebug"));
        }else {
            document.dispatchEvent(new Event("stopSensorDebug"));
        }

        if (selectedMode === "MOTOR_DEBUG") {
            document.dispatchEvent(new Event("startMotorDebug"));
        }else {
            document.dispatchEvent(new Event("stopMotorDebug"));;
        }

    } catch (error) {
        console.error("❌ Error changing mode:", error);
        alert("Failed to change mode");
        return;
    }

    document.dispatchEvent(new Event("fetchState"));
}

export async function updateSpeedCommand(wheel, speed) {
    console.log(`Updating ${wheel} speed to: ${speed}`);
    
    // Send command and wait for response
    await device.sendCommandAndWait(
        `SET_SPEED:${wheel}=${speed}`,
        new RegExp(`^Desired`), 
        5000
    );
}

export async function turnAroundCommand() {
    console.log(`Sending Turn Around Command`);
    
    // Send command and wait for response
    await device.sendCommandAndWait(
        `TURN_AROUND`,
        new RegExp(`^TURNING_AROUND`), 
        5000
    );
}

export async function stopCommand() {
    console.log("Sending Stop Command");
    changeMode("IDLE");
    document.dispatchEvent(new Event("fetchState"));
}

export async function callibrateWhiteCommand() {
    console.log("Sending Callibrate White Command");
    await device.sendCommandAndWait(`CALLIBRATE_WHITE`, new RegExp(`CALLIBRATING_WHITE`), 5000);
    document.dispatchEvent(new Event("fetchState"));
}

export async function callibrateBlackCommand() {
    console.log("Sending Callibrate White Command");
    await device.sendCommandAndWait(`CALLIBRATE_BLACK`, new RegExp(`CALLIBRATING_BLACK`), 5000);
    document.dispatchEvent(new Event("fetchState"));
}

export async function fetchBatteryCommand() {
    console.log("Sending Battery Command");
    await device.sendCommandAndWait(`BATTERY`, new RegExp(`^SENDING_BATTERY`), 5000);
}