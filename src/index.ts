import { Telegraf } from "telegraf";
import mqtt from "mqtt";
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get the current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the .env file from the root of the project
dotenv.config({ path: resolve(__dirname, '../.env') });

const BOT_TOKEN = process.env.BOT_TOKEN;
const MQTT_BROKER = process.env.MQTT_BROKER;

console.log("BOT_TOKEN:", process.env.BOT_TOKEN);
console.log("MQTT_BROKER:", process.env.MQTT_BROKER);

if (!BOT_TOKEN || !MQTT_BROKER) {
    throw new Error("BOT_TOKEN and MQTT_BROKER must be set in the .env file");
}

interface SensorData {
    esp_code: string;
    airTemp: number;
    airHumidity: any;
    soilMoisture: number;
    waterLevel: number;
    minAirTemp: number;
    maxAirTemp: number;
    minAirHumidity: number;
    maxAirHumidity: number;
    minSoilMoisture: number;
    isIrrigating: boolean;
}

enum IrrigationStatus {
    Inactive = 0,
    Active = 1,
}

// MQTT topics (dynamic based on esp_code)
const createTopic = (baseTopic: string, espCode: string) => baseTopic.replace('%s', espCode);

const bot = new Telegraf(BOT_TOKEN);
const mqttClient = mqtt.connect(MQTT_BROKER);

// Map to associate ESP32 devices with Telegram users
const espToChatMap = new Map<string, number>();

mqttClient.on("connect", () => {
    console.log("✅ Connected to the MQTT broker");
    // Example subscription: Subscribe to dynamic topics
    // You can dynamically subscribe to any topic related to ESP32s as they are registered
});

mqttClient.on("message", (topic, message) => {
    const rawMessage = message.toString();
    console.log(`📩 Message received on ${topic}: ${rawMessage}`);

    const espCodeMatch = topic.match(/plant\/status\/response\/(ESP_\d{8})/);
    if (espCodeMatch) {
        const espCode = espCodeMatch[1];

        // Handle the irrigation status response
        if (topic === createTopic('plant/status/response/%s', espCode)) {
            let data: SensorData = {
                esp_code: "",
                airTemp: 0,
                airHumidity: 0,
                soilMoisture: 0,
                waterLevel: 0,
                minAirTemp: 0,
                maxAirTemp: 0,
                minAirHumidity: 0,
                maxAirHumidity: 0,
                minSoilMoisture: 0,
                isIrrigating: false
            };
            try {
                data = JSON.parse(rawMessage);
            } catch (error) {
                console.warn("⚠️ Malformed JSON, ignoring message:", rawMessage);
                return;
            }

            const chatId = espToChatMap.get(data.esp_code);

            if (chatId) {
                const irrigationStatusMessage = data.isIrrigating
                    ? "💧 Irrigation active ✅"
                    : "🛑 Irrigation inactive ❌";

                const telegramMessage = `
🌱 Irrigation Status for ESP32 (${data.esp_code})

Current Values:
- 🌡️ Air Temperature: ${data.airTemp}°C
- 💧 Air Humidity: ${data.airHumidity}%
- 🌿 Soil Moisture: ${data.soilMoisture}%

Optimal Ranges:
- 🌡️ Air Temperature: ${data.minAirTemp}°C - ${data.maxAirTemp}°C
- 💧 Air Humidity: ${data.minAirHumidity}% - ${data.maxAirHumidity}%

Irrigation Status:
- ${irrigationStatusMessage}
`;

                bot.telegram.sendMessage(chatId, telegramMessage);
            } else {
                console.log(`⚠️ No user associated with ESP32 ${data.esp_code}`);
            }
        }
    }
});

bot.command("register", (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length !== 2) {
        ctx.reply("❌ Use /register <ESP_XXXXXXXX> to register your ESP32.");
        return;
    }

    const espCode = args[1];
    if (!/^ESP_\d{8}$/.test(espCode)) {
        ctx.reply("❌ Invalid format! Use ESP_ followed by 8 digits.");
        return;
    }

    espToChatMap.set(espCode, ctx.chat.id);
    ctx.reply(`✅ ESP32 (${espCode}) successfully registered to your account!`);

    // Subscribe to the topics dynamically based on the registered esp_code
    mqttClient.subscribe(createTopic('plant/status/response/%s', espCode));
    mqttClient.subscribe(createTopic('plant/irrigation/start/response/%s', espCode));
    mqttClient.subscribe(createTopic('plant/irrigation/stop/response/%s', espCode));
});

bot.command("start_irrigation", (ctx) => {
    const espCode = ctx.message.text.split(" ")[1];
    if (!espCode) {
        return ctx.reply("❌ Please provide the ESP32 code. Example: /start_irrigation ESP_XXXXXXXX");
    }

    mqttClient.publish(createTopic('plant/irrigation/start/request/%s', espCode), JSON.stringify({ esp_code: espCode }));
    ctx.reply("🚰 Irrigation started!");
});

bot.command("stop_irrigation", (ctx) => {
    const espCode = ctx.message.text.split(" ")[1];
    if (!espCode) {
        return ctx.reply("❌ Please provide the ESP32 code. Example: /stop_irrigation ESP_XXXXXXXX");
    }

    mqttClient.publish(createTopic('plant/irrigation/stop/request/%s', espCode), JSON.stringify({ esp_code: espCode }));
    ctx.reply("🛑 Irrigation stopped!");
});

bot.command("get_status", (ctx) => {
    const espCode = ctx.message.text.split(" ")[1];
    if (!espCode) {
        return ctx.reply("❌ Please provide the ESP32 code. Example: /get_status ESP_XXXXXXXX");
    }

    mqttClient.publish(createTopic('plant/status/request/%s', espCode), JSON.stringify({ esp_code: espCode }));
    console.warn(createTopic('plant/status/request/%s', espCode))
    ctx.reply("📩 Status request sent!");
});

bot.command("help", (ctx) => {
    ctx.reply(
        `
ℹ️ <b>Bot Usage Guide</b>

1️⃣ <b>ESP32 Registration:</b>
   ➝ Use /register ESP_XXXXXXXX to associate your ESP32 with the bot.

2️⃣ <b>Irrigation Control:</b>
   ➝ /start_irrigation ESP_XXXXXXXX to start the irrigation for your plant.
   ➝ /stop_irrigation ESP_XXXXXXXX to stop it.

3️⃣ <b>Plant Status:</b>
   ➝ /get_status ESP_XXXXXXXX to get the current status of your plant.

4️⃣ <b>Useful Info:</b>
   ➝ /help for this guide.
`,
        { parse_mode: "HTML" }
    );
});

bot.launch().then(() => {
    console.log("🤖 Telegram bot started successfully");
});

process.on("SIGINT", () => {
    bot.stop("SIGINT");
    mqttClient.end();
    console.log("❌ Telegram bot and MQTT connection closed");
    process.exit(0);
});
