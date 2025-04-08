#!/bin/bash

# Build per Mosquitto
echo "Building Mosquitto Docker image..."
docker build -t riccardogabellini/mosquitto-custom:latest -f mosquitto.Dockerfile ./

# Push per Mosquitto
echo "Pushing Mosquitto Docker image to Docker Hub..."
docker push riccardogabellini/mosquitto-custom:latest

# Build per il Bot
echo "Building Plant Sense Bot Docker image..."
docker build -t riccardogabellini/plant-sense-bot:latest -f bot.Dockerfile ./

# Push per il Bot
echo "Pushing Plant Sense Bot Docker image to Docker Hub..."
docker push riccardogabellini/plant-sense-bot:latest

echo "Build and Push process completed."
