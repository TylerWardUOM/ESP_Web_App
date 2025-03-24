import ConnectionManager from "./ConnectionManager.js";
import DataHandler from "./DataHandler.js"; // Assuming you save the class in a separate file

class Device {
    constructor() {
        this.connectionManager = new ConnectionManager();
        this.dataHandler = new DataHandler();

        // Pass BLE characteristic and serial writer to DataHandler
        this.connectionManager.on("connected", () => {
            this.dataHandler.setBLE(this.connectionManager.bleCharacteristic);
            this.dataHandler.setSerial(this.connectionManager.serialWriter);
        });

        // Subscribe to the "dataReceived" event and forward data to DataHandler
        this.connectionManager.on("dataReceived", (data) => {
            this.dataHandler.handleData(data);
        });
    }

    async sendCommandAndWait(command, expectedResponse, timeout = 5000) {
        return this.dataHandler.sendCommandAndWait(command, expectedResponse, timeout);
    }

    async scanSerial(){
        await this.connectionManager.scanSerial();
    }

    async scanBLE(){
        await this.connectionManager.scanBLE();
    }

    async disconnect() {
        await this.connectionManager.disconnect();
    }

    get isConnected() {
        return this.connectionManager.isConnected;
    }

    get buggyState(){
        return this.dataHandler.buggyState;
    }

    set initialParameters(initialParameters){
        this.dataHandler.initialParameters=initialParameters;
    }

    set lastRunMode(lastRunMode){
        this.dataHandler.lastRunMode=lastRunMode;
    }

    get lastRunMode(){
        return this.dataHandler.lastRunMode;
    }

    set lastRunParameters(lastRunParameters){
        this.dataHandler.lastRunParameters=lastRunParameters;
    }

    get lastRunParameters(){
        return this.dataHandler.lastRunParameters;
    }

    get accumulatedDebugData(){
        return this.dataHandler.accumulatedDebugData;
    }
}

export default Device;
