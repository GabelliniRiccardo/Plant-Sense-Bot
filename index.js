import { Telegraf } from "telegraf";
import mqtt from "mqtt";
import dotenv from "dotenv";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const MQTT_BROKER = process.env.MQTT_BROKER;

const bot = new Telegraf(BOT_TOKEN);
const mqttClient = mqtt.connect(MQTT_BROKER);

// Map to associate ESP32 devices with Telegram users
const espToChatMap = new Map();

// Connect to the MQTT broker
mqttClient.on("connect", () => {
    console.log("✅ Connected to the MQTT broker");
    mqttClient.subscribe("esp32/status"); // Subscribe to receive updates from ESP32
});

// When an MQTT message is received
mqttClient.on("message", (topic, message) => {
    console.log(`📩 Message received on ${topic}: ${message.toString()}`);

    if (topic === "esp32/status") {
        const data = JSON.parse(message.toString());
        const chatId = espToChatMap.get(data.esp_code);

        if (chatId) {
            const telegramMessage = `
                🌱 Irrigation Status for ESP32 (${data.esp_code})

                Current Values:
                - 🌡️ Air Temperature: ${data.airTemp}°C
                - 💧 Air Humidity: ${data.airHumidity}%
                - 🌿 Soil Moisture: ${data.soilMoisture}%

                Optimal Ranges:
                - 🌡️ Air Temperature: ${data.minAirTemp}°C - ${data.maxAirTemp}°C
                - 💧 Air Humidity: ${data.minAirHumidity}% - ${data.maxAirHumidity}%
                - 🌿 Soil Moisture: ${data.minSoilMoisture}%

                Irrigation Status:
                - 💧 Irrigation: ${data.isIrrigating ? "Active ✅" : "Inactive ❌"}
            `;

            bot.telegram.sendMessage(chatId, telegramMessage);
        } else {
            console.log(`⚠️ No user associated with ESP32 ${data.esp_code}`);
        }
    }
});

// Command to register the ESP32 with the Telegram user
bot.command("register", (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length !== 2) {
        ctx.reply(
            "❌ Use the command /register <ESP_XXXXXXXX> to register your ESP32.",
        );
        return;
    }

    const espCode = args[1];
    if (!/^ESP_\d{8}$/.test(espCode)) {
        ctx.reply(
            "❌ Invalid format! Use ESP_ followed by 8 digits (e.g., ESP_12345678).",
        );
        return;
    }

    espToChatMap.set(espCode, ctx.chat.id);
    ctx.reply(`✅ ESP32 (${espCode}) successfully registered to your account!`);
});

// Command to start the irrigation
bot.command("start_irrigation", (ctx) => {
    mqttClient.publish("esp32/irrigation/start", "1");
    ctx.reply("🚰 Irrigation started!");
});

// Command to stop the irrigation
bot.command("stop_irrigation", (ctx) => {
    mqttClient.publish("esp32/irrigation/stop", "0");
    ctx.reply("🛑 Irrigation stopped!");
});

// Command to display help
bot.command("help", (ctx) => {
    ctx.reply(
        `
ℹ️ <b>Bot Usage Guide</b>

1️⃣ <b>ESP32 Registration:</b>
   ➝ Use /register ESP_XXXXXXXX to associate your ESP32 with the bot.

2️⃣ <b>Irrigation Control:</b>
   ➝ /start_irrigation to start the irrigation.
   ➝ /stop_irrigation to stop it.

3️⃣ <b>Useful Info:</b>
   ➝ /help for this guide.
`,
        { parse_mode: "HTML" },
    );
});

// Start the Telegram bot
bot.launch().then(() => {
    console.log("🤖 Telegram bot started successfully");
});

// Graceful shutdown handling
process.on("SIGINT", () => {
    bot.stop("SIGINT");
    mqttClient.end();
    console.log("❌ Telegram bot and MQTT connection closed");
    process.exit(0);
});
