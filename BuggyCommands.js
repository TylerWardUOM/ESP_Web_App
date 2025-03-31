import {device} from './Device.js';

export async function updateParameters() {
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

    // Reset all input colors to gray after update
    paramInputs.forEach(input => {
        input.dataset.initial = input.value; // Update stored initial value
        input.style.color = "gray"; // Reset color
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