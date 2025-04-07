# Usa l'immagine ufficiale di Mosquitto come base
FROM eclipse-mosquitto:latest

# Copia il file di configurazione personalizzato nella cartella /mosquitto/config/
COPY mosquitto/config /mosquitto/config

# Espone le porte MQTT e WebSocket
EXPOSE 1883 9001
